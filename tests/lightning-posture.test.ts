import { describe, expect, it } from "vitest";
import {
  evaluateLightningPosture,
  isValidLightningPubkey,
  type MempoolLightningChannel,
  type MempoolLightningNode,
} from "../src/lib/lightning-posture";

describe("Lightning posture evaluator", () => {
  it("validates 66-hex compressed pubkeys", () => {
    expect(
      isValidLightningPubkey(
        "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f"
      )
    ).toBe(true);
    expect(isValidLightningPubkey("not-a-pubkey")).toBe(false);
  });

  it("scores a hardened hybrid node with diversified channels highly", () => {
    const now = 1795642629;
    const node: MempoolLightningNode = {
      public_key: "03".padEnd(66, "a"),
      alias: "HardenedRouter",
      first_seen: now - 86400 * 365,
      updated_at: now - 3600,
      color: "#f7931a",
      sockets: "203.0.113.5:9735,exampleonionaddress1234567890.onion:9735",
      as_number: 64500,
      as_organization: "Self-Hosted Fiber ISP",
      iso_code: "CH",
      country: { en: "Switzerland" },
      features: [
        { bit: 0, name: "data-loss-protect", is_required: true, is_known: true },
        { bit: 12, name: "option_static_remotekey", is_required: true, is_known: true },
        { bit: 23, name: "option_anchors_zero_fee_htlc_tx", is_required: false, is_known: true },
        { bit: 25, name: "option_route_blinding", is_required: false, is_known: true },
        { bit: 39, name: "option_onion_messages", is_required: false, is_known: true },
      ],
    };

    const channels: MempoolLightningChannel[] = [1, 2, 3, 4, 5, 6].map((i) => ({
      status: 1,
      capacity: 10_000_000,
      short_id: `800000x${i}x0`,
      id: `${i}`,
      fee_rate: 250,
      node: {
        alias: `Peer-${i}`,
        public_key: `02${String(i).padStart(64, "0")}`,
        channels: 20,
        capacity: 100_000_000,
      },
    }));

    const report = evaluateLightningPosture(node, channels, now);
    expect(report.score).toBe(100);
    expect(report.grade).toBe("A");
    expect(report.transport.mode).toBe("hybrid-clearnet-tor");
    expect(report.transport.isMajorCloudHost).toBe(false);
  });

  it("penalizes missing DLP/anchors, hyperscaler clearnet exposure, and single-peer concentration", () => {
    const now = 1795642629;
    const node: MempoolLightningNode = {
      public_key: "02".padEnd(66, "b"),
      alias: "FragileCloudNode",
      first_seen: now - 86400 * 100,
      updated_at: now - 86400 * 45, // stale 45 days
      color: "#ff0000",
      sockets: "3.33.236.230:9735",
      as_number: 16509,
      as_organization: "Amazon.com",
      iso_code: "US",
      country: { en: "United States" },
      features: [],
    };

    const channels: MempoolLightningChannel[] = [
      {
        status: 1,
        capacity: 90_000_000,
        short_id: "800000x1x0",
        id: "1",
        fee_rate: 1000,
        node: {
          alias: "SingleWhale",
          public_key: "03".padEnd(66, "c"),
          channels: 500,
          capacity: 500_000_000,
        },
      },
    ];

    const report = evaluateLightningPosture(node, channels, now);
    expect(report.score).toBeLessThan(35);
    expect(report.grade).toBe("F");
    expect(report.transport.isMajorCloudHost).toBe(true);
    expect(report.metrics.topPeerSharePct).toBe(100);
    expect(report.metrics.hhiConcentration).toBe(10000);
  });
});
