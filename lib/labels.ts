import fs from "fs";
import path from "path";

import type { Label, NodeKind } from "./types";

type LabelResult = {
  kind: NodeKind;
  label?: Label;
};

type WalletRecord = {
  address: string;
  entity: string;
  type: string;
  confidence: number;
  source: Label["source"];
};

function loadDataset(fileName: string): WalletRecord[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    fileName
  );

  try {
    const file = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(file) as WalletRecord[];
  } catch {
    return [];
  }
}

export function labelWallet(address: string): LabelResult {
  const hotWallets = loadDataset("hot-wallets.json");
  const depositAddresses = loadDataset(
    "deposit-addresses.json"
  );
  const riskAddresses = loadDataset("risk-lists.json");

  const riskMatch = riskAddresses.find(
    (wallet) => wallet.address === address
  );

  if (riskMatch) {
    const label: Label = {
      entity: riskMatch.entity,
      type: riskMatch.type,
      source: riskMatch.source,
      confidence: riskMatch.confidence,
    };

    return {
      kind:
        riskMatch.type === "sanctioned"
          ? "sanctioned"
          : "mixer",
      label,
    };
  }

  const hotWalletMatch = hotWallets.find(
    (wallet) => wallet.address === address
  );

  if (hotWalletMatch) {
    const label: Label = {
      entity: hotWalletMatch.entity,
      type: hotWalletMatch.type,
      source: hotWalletMatch.source,
      confidence: hotWalletMatch.confidence,
    };

    return {
      kind: "exchange_hot",
      label,
    };
  }

  const depositMatch = depositAddresses.find(
    (wallet) => wallet.address === address
  );

  if (depositMatch) {
    const label: Label = {
      entity: depositMatch.entity,
      type: depositMatch.type,
      source: depositMatch.source,
      confidence: depositMatch.confidence,
    };

    return {
      kind: "exchange_deposit",
      label,
    };
  }

  return {
    kind: "intermediary",
  };
}