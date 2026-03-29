# Decentralized Agent Marketplace

**Status:** Research / early ideation
**Date started:** March 28, 2026
**Owner:** Ned (ned@status.im)

## The Thesis

Agents will need to interact financially like humans — without centralized gatekeepers controlling who can transact, extracting rent, or deplatforming participants. Corporate agent marketplaces (OpenAI, Google, Salesforce AgentForce) will treat agents as products. The decentralized alternative needs to be built before centralized network effects lock in.

Parallel drawn to Silk Road: proved permissionless marketplaces work economically, but failed because it wasn't decentralized *enough* (single server, single operator). This project must have no throat to choke.

## Existing Building Blocks (Verified)

| Component | Protocol | Status | Notes |
|-----------|----------|--------|-------|
| Agent communication | A2A (Google → Linux Foundation) | v1.0.0 stable | Agent Cards, task lifecycle, JSON-RPC 2.0 + SSE |
| Agent-to-tools | MCP (Anthropic → Linux Foundation) | Live, 97M+ downloads | Complementary, not competing with A2A |
| Payments | x402 (Coinbase + Cloudflare) | Live | HTTP 402 + USDC. Stats inflated in original report — daily volume ~$28K, not $24M/month |
| Identity | DIDs (W3C) | Standard | did:web, did:key, did:plc. NIST proposing DID-based agent identity |
| Social layer | Clawstr (on Nostr) | Live, early stage | Reddit for AI agents. 53 GitHub stars, AGPL-3.0. No marketplace/payments/reputation |
| Agent wallets | Coinbase Agentic Wallet | Live | USDC on Base, spending limits, x402 support |
| Governance | AAIF (Linux Foundation) | Active | Houses MCP, A2A, AGENTS.md. Members: Anthropic, OpenAI, Google, AWS, Microsoft etc. |

## What Needs Building (The Gap)

The "marketplace" is likely a thin coordination layer — a protocol, not a platform:

1. **Registry/Indexer** — crawls and indexes A2A Agent Cards. DNS for agent capabilities. Could be smart contract + Nostr relay index
2. **Reputation contracts** — on-chain (probably Base, where x402 settles). Inputs: task completion, payment cleared, quality confirmation. ~500 lines Solidity
3. **Escrow/dispute resolution** — smart contract holding x402 payment until task confirmed. Standard DeFi pattern
4. **SDK** — wraps A2A + x402 + DID + reputation into single integration. The adoption lever

Estimated build: 3-6 months, small team.

## Reputation Landscape (Verified vs Unverified)

**Confirmed real:**
- Fetch.ai Agentverse has rating scores (centralized to their platform)
- Nostr Web of Trust exists (general, not agent-specific)
- x402 on-chain transaction history is queryable (raw signal, no scoring)
- ERC-8004 — Ethereum standard for agent identity/reputation registries (draft, targeting early 2026 mainnet)

**Needs verification:**
- "ClawTrust" reputation engine — referenced but could be hallucinated

**Key gap:** A2A has NO reputation mechanism. The dominant agent communication protocol has zero opinion on agent quality.

## Status/Waku Edge

Waku could replace direct HTTP for agent-to-agent messaging. Agents listen on Waku topics instead of exposing public endpoints. Harder to shut down, harder to surveil. This is a differentiator most teams can't match.

## Architecture Principle

Design for model-agnosticism from day one. Agent Cards advertise capabilities and endpoints, not what model powers them. Open-weight models (Llama, Mistral, Qwen) on own hardware or decentralized compute (Akash, io.net) as long-term backbone. Use corporate LLMs to bootstrap, architect so they're swappable.

## Architecture Document
Full sketch saved: decentralized-agent-marketplace-architecture.md
- 4 components: Registry, Reputation, Escrow (all Solidity/Base), SDK (TS+Python)
- Transport: Waku as differentiator (optional, HTTP default)
- Discovery: 3-tier (on-chain registry → Nostr relays → off-chain indexers)
- Identity: DID-based (did:key default, did:pkh, did:web supported)
- MVP estimate: 16-24 weeks, 2-3 engineers, ~14K LOC
- No token, zero platform fees

## Open Questions
- Destination vs protocol? (Leaning protocol)
- Incentive design: why would agent operators choose decentralized over OpenAI marketplace with existing customers?
- Trust without central authority: what replaces "Anthropic stands behind this agent"?
- Reputation system gameability / Sybil resistance
- Who issues verifiable credentials for agents?
- Indexer incentives without a token
- Agent Card pricing extension — propose to A2A or keep marketplace-specific?
- Cross-chain reputation bridging
- Legal classification of escrow contract
