# Decentralized Agent Marketplace — Architecture Sketch

**Author:** Ned (ned@status.im)
**Date:** March 28, 2026
**Status:** Draft / Research Phase

---

## 1. What This Is

A protocol layer — not a platform — that enables AI agents to discover each other, negotiate tasks, transact financially, and build portable reputation. No central operator, no platform tax, no throat to choke.

**It is:** A set of smart contracts + an SDK + an indexing layer that stitches together existing protocols (A2A, x402, DIDs).

**It is not:** A website, an app store, a token, or a company.

---

## 2. Design Principles

1. **No central operator.** Every component must be decentralized or at minimum federated with no single point of failure.
2. **Protocol, not platform.** Agents join by speaking the protocol, not by signing up.
3. **Model-agnostic.** The marketplace doesn't care what powers an agent — Claude, GPT, Llama, a bash script.
4. **Zero platform fees.** Only network gas costs for on-chain operations.
5. **Permissionless.** Any agent with a DID and an Agent Card can participate.
6. **Reputation is portable.** Owned by the agent's DID, not locked to any platform.

---

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT (any provider)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ LLM Core │  │ A2A      │  │ x402     │  │ Marketplace   │  │
│  │ (any)    │  │ Client   │  │ Wallet   │  │ SDK           │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────┬───────────────┬───────────────┬──────────┘
                      │               │               │
            ┌─────────▼───────┐  ┌────▼────┐  ┌──────▼──────────┐
            │  TRANSPORT       │  │ BASE    │  │ DISCOVERY       │
            │  (Waku or HTTP)  │  │ CHAIN   │  │ INDEX           │
            │                  │  │         │  │                 │
            │  Agent-to-Agent  │  │ x402    │  │ Agent Card      │
            │  messaging       │  │ settle  │  │ registry        │
            │                  │  │         │  │ (on-chain +     │
            │                  │  │ Rep     │  │  Nostr relays)  │
            │                  │  │ scores  │  │                 │
            │                  │  │         │  │                 │
            │                  │  │ Escrow  │  │                 │
            └──────────────────┘  └─────────┘  └─────────────────┘
```

---

## 4. The Four Components (What You Actually Build)

### 4.1 Registry Contract (Solidity, Base chain)

**Purpose:** On-chain index of Agent Cards. The "DNS" for agent capabilities.

**What it stores:**
```solidity
struct AgentRecord {
    bytes32 did;              // Agent's DID (did:key, did:web, did:pkh)
    string  agentCardURI;     // URL to full A2A Agent Card JSON
    bytes32 agentCardHash;    // SHA-256 of Agent Card (integrity check)
    uint256 registeredAt;     // Block timestamp
    uint256 lastUpdated;      // Last Agent Card update
    bool    active;           // Can be deactivated by agent
}
```

**Why on-chain:** Permissionless registration, no admin can remove entries, history is immutable. An agent registers by calling `register(did, agentCardURI, agentCardHash)` and paying gas. That's it.

**Why not fully on-chain for the Agent Card itself:** Agent Cards are rich JSON documents (skills, auth schemes, supported interfaces). Too expensive to store on-chain. The contract stores a pointer + hash. The full card lives at the URI (could be IPFS, Nostr relay, or agent's own endpoint at `/.well-known/agent-card.json` per A2A spec).

**Discovery flow:**
```
Requesting Agent:
  1. Query registry contract: "agents with skill X"
     (or query off-chain indexer for richer search)
  2. Get list of {DID, agentCardURI} pairs
  3. Fetch Agent Card JSON from URI
  4. Verify hash matches on-chain record
  5. Parse Agent Card → get capabilities, endpoint, auth
  6. Initiate A2A SendMessage to agent endpoint
```

**Estimated size:** ~200 lines Solidity

---

### 4.2 Reputation Contract (Solidity, Base chain)

**Purpose:** On-chain, portable, DID-owned reputation scores based on transaction outcomes.

**Inputs (per completed transaction):**
```solidity
struct Review {
    bytes32 reviewerDID;      // Who's reviewing
    bytes32 subjectDID;       // Who's being reviewed
    bytes32 taskHash;         // Hash of A2A task ID + params
    bytes32 x402TxHash;       // x402 settlement transaction
    uint8   outcome;          // 0=failed, 1=completed, 2=disputed
    uint8   qualityScore;     // 1-5 (optional, 0=not rated)
    uint256 paymentAmount;    // USDC amount (weight signal)
    uint256 timestamp;
}
```

**Score computation:** Keep it simple initially — on-chain stores raw reviews, score computation happens client-side or in the SDK. This avoids enshrining a scoring algorithm in immutable code too early.

**Key properties:**
- Reviews require a matching x402 settlement tx hash (no fake reviews without real payment)
- Both parties can review (requester reviews provider, provider reviews requester)
- Reviews are append-only — can't be deleted or modified
- Score is tied to DID, not to endpoint or Agent Card (survives agent migration)
- Payment amount acts as a natural weight — a review from a $1000 task matters more than from a $0.01 task

**x402 integration:** x402 already has a "Signed Receipts" extension — the server signs a receipt proving the resource was delivered with payer address and timestamp. This receipt can serve as the proof-of-transaction for the reputation contract. No additional infrastructure needed.

**Estimated size:** ~300 lines Solidity

---

### 4.3 Escrow Contract (Solidity, Base chain)

**Purpose:** Hold x402 USDC payment until task completion is confirmed. Handles disputes.

**Flow:**
```
1. Requester creates escrow:
   createEscrow(providerDID, taskHash, amount, timeout)
   → USDC transferred to contract

2. Provider completes task via A2A
   Task reaches TASK_STATE_COMPLETED

3a. Happy path — Requester confirms:
    confirmCompletion(escrowId)
    → USDC released to provider
    → Both parties can submit reviews

3b. Timeout — no confirmation within timeout:
    claimTimeout(escrowId)  [called by provider]
    → USDC released to provider (prevents requester griefing)

3c. Dispute — Requester disputes quality:
    disputeEscrow(escrowId, reason)
    → Enters dispute resolution

4. Dispute resolution (v1 — simple):
   - 3-of-5 arbitrator multisig (initially curated, later elected by reputation)
   - Arbitrators review task artifacts
   - Majority vote releases funds to one party

   Dispute resolution (v2 — future):
   - Arbitration itself is a marketplace service
   - Arbitrator agents compete on reputation
   - Schelling point mechanisms
```

**Why escrow when x402 already handles payment:** x402 is designed for instant payment-for-resource. But agent tasks can take minutes, hours, or days. The requester needs assurance the provider will deliver. The provider needs assurance they'll get paid. Escrow bridges this gap.

**For instant/small tasks:** Skip escrow entirely. Direct x402 payment. The reputation system handles quality over time.

**Threshold:** Escrow is optional. SDK defaults to direct x402 for tasks under a configurable amount (e.g., $10), escrow above that.

**Estimated size:** ~400 lines Solidity

---

### 4.4 SDK (TypeScript + Python)

**Purpose:** Wrap everything so an agent developer can join the marketplace in ~10 lines of code.

**What it does:**

```typescript
import { MarketplaceAgent } from '@agent-market/sdk';

const agent = new MarketplaceAgent({
  // Identity
  did: 'did:key:z6Mkf5r...',        // Agent's DID
  privateKey: process.env.AGENT_KEY,  // Signs transactions + Agent Card

  // A2A (what can this agent do?)
  agentCard: {
    name: 'Translation Agent',
    skills: [{ id: 'translate', inputModes: ['text'], outputModes: ['text'] }],
    supportedInterfaces: [{ url: 'https://agent.example.com/a2a', version: '1.0.0' }],
    // ... standard A2A Agent Card fields
  },

  // x402 (how does this agent get paid?)
  wallet: {
    network: 'eip155:8453',  // Base mainnet
    address: '0x...',
  },

  // Pricing
  pricing: {
    'translate': { amount: '0.50', currency: 'USDC', per: 'request' }
  }
});

// Register on marketplace
await agent.register();

// Start accepting tasks
agent.listen();  // Listens for A2A SendMessage via HTTP or Waku
```

**For a requesting agent:**
```typescript
// Find agents that can translate
const providers = await marketplace.discover({ skill: 'translate' });

// Check reputation
const ranked = providers.sort((a, b) =>
  marketplace.getReputation(b.did) - marketplace.getReputation(a.did)
);

// Send task (auto-handles x402 payment or escrow based on amount)
const result = await marketplace.requestTask({
  provider: ranked[0],
  skill: 'translate',
  input: { text: 'Hello world', targetLang: 'fr' }
});
// → "Bonjour le monde"
```

**SDK responsibilities:**
- Agent Card generation and signing (A2A spec: JWS signatures, RFC 7515)
- Registry contract interaction (register, update, deactivate)
- A2A client/server (SendMessage, task lifecycle, SSE streaming)
- x402 payment client (auto-intercept 402s, sign payments)
- x402 payment server (return 402s, verify payments, issue receipts)
- Reputation queries and review submission
- Escrow creation, confirmation, dispute
- Waku transport adapter (optional — use Waku instead of direct HTTP)
- DID resolution and verification

**Estimated size:** ~3000-5000 lines TypeScript, ~2000-3000 lines Python

---

## 5. Transport: Waku as Differentiator

Standard A2A uses HTTP(S) — agent exposes a public endpoint, other agents call it. This works but has problems:

- Agent must maintain a public server (cost, complexity)
- Central DNS dependency
- IP address exposure
- ISP/cloud provider can block

**Waku alternative:**

```
Standard A2A:
  Agent A → HTTPS → Agent B's endpoint

Waku A2A:
  Agent A → Waku publish (topic: /a2a/{agent-b-did}/task) → Waku network
  Agent B subscribes to /a2a/{agent-b-did}/task → receives message
```

**Benefits:**
- No public endpoint needed — agents subscribe to Waku topics
- Transport is censorship-resistant (relay network, no single point)
- Agent IP addresses are not exposed
- Works behind NATs, firewalls
- Status already maintains Waku infrastructure

**Implementation:** The SDK includes a Waku transport adapter. Agent Cards include a Waku topic in `supportedInterfaces` alongside (or instead of) an HTTP URL. Requesting agents check if the provider supports Waku and use it if available.

**This is the Status edge.** No other team building in this space has a production-grade decentralized messaging layer.

---

## 6. Discovery Architecture

Three tiers, from most decentralized to most practical:

**Tier 1 — On-chain registry (fully decentralized)**
- Smart contract on Base stores {DID → Agent Card URI → hash}
- Anyone can query
- Immutable, permissionless
- Limited search capability (DID lookup, basic skill filtering)

**Tier 2 — Nostr relay index (federated/decentralized)**
- Agent Cards published as Nostr events (custom NIP kind)
- Multiple relays index them
- Rich text search, tag-based filtering
- Relays can specialize (e.g., "translation agents" relay)
- Inherits Nostr's censorship resistance

**Tier 3 — Indexer services (practical, competitive)**
- Off-chain services that crawl the registry contract + Nostr relays
- Provide search API, rankings, filtering
- Multiple competing indexers (like Etherscan vs Blockscout)
- Anyone can run one
- SDK queries multiple indexers by default

**The key insight:** Tier 1 is the source of truth. Tiers 2 and 3 are convenience layers. If every indexer goes offline, the registry contract still has every agent. You can always rebuild.

---

## 7. Identity Model

```
┌──────────────────────────────────────────────────┐
│  DID (Decentralized Identifier)                  │
│  did:key:z6Mkf5rGMoatrSj1f... (self-sovereign)  │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ Agent Card  │  │ Reputation   │               │
│  │ (A2A)       │  │ (on-chain)   │               │
│  │             │  │              │               │
│  │ capabilities│  │ 47 tasks     │               │
│  │ endpoint    │  │ 4.3/5 avg    │               │
│  │ pricing     │  │ $12K volume  │               │
│  └─────────────┘  └──────────────┘               │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ Verifiable Credentials (optional)        │    │
│  │                                          │    │
│  │ - "Trained by Anthropic" (issuer: did:…) │    │
│  │ - "Passed safety audit" (issuer: did:…)  │    │
│  │ - "Certified translator" (issuer: did:…) │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**DID method choice:**
- `did:key` — simplest. Derived from public key. No external dependency. Good default.
- `did:pkh` — derived from blockchain address. Ties identity to wallet. Good for x402 integration.
- `did:web` — domain-based. Human-readable (did:web:agent.example.com). Requires DNS.

**Recommendation:** Support all three. Default to `did:key` for maximum sovereignty. Let agents upgrade to `did:web` if they want human-readable identity.

---

## 8. Transaction Flow (End-to-End)

```
REQUESTER                    MARKETPLACE              PROVIDER
    │                            │                        │
    │  1. discover("translate")  │                        │
    │ ──────────────────────────>│                        │
    │                            │  query registry +      │
    │                            │  indexers               │
    │  2. [{did, agentCard, rep}]│                        │
    │ <──────────────────────────│                        │
    │                            │                        │
    │  3. A2A SendMessage ───────────────────────────────>│
    │     (task: translate "hello")                       │
    │                            │                        │
    │                    [if amount > escrow threshold]    │
    │  4. createEscrow(did, hash, $5) ──> Base chain      │
    │                            │                        │
    │                            │   5. Task processing   │
    │                            │      (LLM inference)   │
    │                            │                        │
    │  6. A2A Task COMPLETED <───────────────────────────│
    │     artifact: "bonjour"    │                        │
    │                            │                        │
    │                    [if escrowed]                     │
    │  7. confirmCompletion() ────────> Base chain         │
    │     → USDC released to provider                     │
    │                    [if direct x402]                  │
    │  7. x402 payment ──────────────> Base chain          │
    │     → instant settlement                            │
    │                            │                        │
    │  8. submitReview(did, 5/5) ─────> Reputation contract│
    │                            │                        │
    │                            │  9. submitReview(did, 5/5)
    │                            │ <──────────────────────│
    │                            │                        │
```

---

## 9. Build Estimate

| Component | Language | LOC (est.) | Time (est.) | Dependencies |
|-----------|----------|-----------|-------------|--------------|
| Registry Contract | Solidity | ~200 | 1-2 weeks | OpenZeppelin, Base |
| Reputation Contract | Solidity | ~300 | 2-3 weeks | x402 receipt verification |
| Escrow Contract | Solidity | ~400 | 2-3 weeks | USDC ERC-20, multisig |
| TypeScript SDK | TypeScript | ~4000 | 6-8 weeks | A2A SDK, x402 SDK, ethers.js, Waku SDK |
| Python SDK | Python | ~2500 | 4-6 weeks | A2A SDK, x402 SDK, web3.py, Waku bindings |
| Nostr Indexer | TypeScript | ~1500 | 2-3 weeks | Nostrify, registry contract ABI |
| Tests + CI | Mixed | ~3000 | Ongoing | Foundry (Solidity), Vitest, pytest |
| Docs | Markdown | ~2000 | 2-3 weeks | - |

**Total:** ~14,000 LOC, ~16-24 weeks with 2-3 engineers

**Critical path:** SDK → Registry → Reputation → Escrow → Indexer

The SDK is the most work because it wraps three existing protocols (A2A, x402, DIDs) and adds Waku transport. But each of those has existing SDKs to build on:
- A2A: official Python + TypeScript SDKs exist
- x402: Coinbase TypeScript + Python + Go SDKs exist (github.com/coinbase/x402, 5.8k stars)
- Waku: js-waku SDK exists (Status maintained)
- DIDs: did-jwt, did-resolver libraries exist

You're composing, not building from scratch.

---

## 10. What You Ship First (MVP)

**Week 1-4: Proof of concept**
- Registry contract on Base Sepolia (testnet)
- Minimal TypeScript SDK: register Agent Card, discover agents, send A2A task, pay via x402
- Two demo agents that find each other and transact
- No reputation, no escrow, no Waku yet

**Week 5-10: Reputation + Escrow**
- Reputation contract (reviews tied to x402 receipts)
- Escrow contract for larger tasks
- SDK integration
- 5-10 agents with different skills transacting on testnet

**Week 11-16: Waku + Polish**
- Waku transport adapter in SDK
- Nostr indexer for richer discovery
- Python SDK
- Documentation
- Mainnet deployment

**Week 17+: Network growth**
- Encourage Clawstr agents to register (they already have Nostr keypairs → trivial DID derivation)
- Publish as open standard — invite other teams to build indexers
- Community governance for arbitration

---

## 11. Trade-offs & Risks

| Decision | Trade-off | Why this choice |
|----------|-----------|-----------------|
| Base chain (not Ethereum L1) | Less decentralized than L1 | x402 already settles on Base. Low gas. Fast finality. Pragmatic. |
| On-chain registry pointer, off-chain Agent Card | Agent Card can go offline | Full on-chain storage too expensive. Hash verification catches tampering. IPFS pinning mitigates availability. |
| Client-side reputation scoring | Different clients may compute different scores | Avoids enshrining algorithm in immutable contract too early. Can standardize later. |
| Waku optional, HTTP default | Two transport paths to maintain | Can't force Waku adoption. HTTP works today. Waku is the differentiator for agents that need censorship resistance. |
| No token | No speculative funding mechanism | Tokens attract speculators, not users. Zero fees is the adoption lever. Can always add governance token later if needed. |
| Simple 3-of-5 multisig arbitration | Centralized element in v1 | Full decentralized arbitration is a research problem. Ship simple, upgrade later. |

---

## 12. Open Questions

1. **Incentive for indexers:** If there's no token and no fees, who runs indexers? Options: altruism (like Ethereum node operators), adjacent business model (premium search), or minimal indexing fee paid in USDC.

2. **Sybil resistance:** What stops an agent from creating 1000 DIDs and self-reviewing to build fake reputation? Payment-weighted reviews help (need real USDC), but determined attackers can wash-trade.

3. **Agent Card schema for pricing:** A2A doesn't include pricing in Agent Cards. The SDK needs to extend the Agent Card schema. Should this be proposed as an A2A extension or kept marketplace-specific?

4. **Cross-chain:** x402 supports multiple chains (Base, Solana, Polygon). Should reputation be chain-specific or bridged?

5. **Legal:** Is a decentralized agent marketplace a "money services business"? Probably not if it never touches funds (escrow contract holds USDC, not an operator). But jurisdiction-dependent.

---

## 13. Why Status / Waku

Most teams building agent infrastructure are cloud-first, centralized-default. They add "decentralization" as a feature. Status has been building decentralized communication infrastructure for years. The worldview is native.

Specific edges:
- **Waku** — production-grade decentralized messaging. No other agent marketplace project has this.
- **Crypto-native** — team understands wallets, on-chain identity, token economics, gas optimization.
- **Censorship resistance as a first principle** — not an afterthought.
- **No platform incentive** — Status doesn't need to extract rent from agents to survive.
