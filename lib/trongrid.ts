import crypto from "crypto";

const TRONGRID_BASE_URL = "https://api.trongrid.io";

export const TRON_USDT_CONTRACT =
  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type TronGridTransfer = {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
  };
  from: string;
  to: string;
  type: string;
  value: string;
  block_timestamp: number;
};

type TronGridResponse = {
  data: TronGridTransfer[];
  meta?: {
    fingerprint?: string;
    page_size?: number;
  };
};

export type TronGridResult = TronGridResponse & {
  provenance: {
    apiCallCount: number;
    responseHashes: string[];
  };
};

function getApiKey() {
  const apiKey = process.env.TRONGRID_API_KEY;

  if (!apiKey) {
    throw new Error("TRONGRID_API_KEY is not configured");
  }

  return apiKey;
}

function hashResponse(rawResponse: string): string {
  return crypto
    .createHash("sha256")
    .update(rawResponse)
    .digest("hex");
}

export async function getUsdtTransfers(
  address: string,
  options?: {
    minTimestamp?: number;
    maxTimestamp?: number;
    onlyConfirmed?: boolean;
    onlyTo?: boolean;
    onlyFrom?: boolean;
    limit?: number;
  }
): Promise<TronGridResult> {
  const url = new URL(
    `${TRONGRID_BASE_URL}/v1/accounts/${address}/transactions/trc20`
  );

  url.searchParams.set("contract_address", TRON_USDT_CONTRACT);
  url.searchParams.set("limit", String(options?.limit ?? 200));

  if (options?.onlyConfirmed !== undefined) {
    url.searchParams.set(
      "only_confirmed",
      String(options.onlyConfirmed)
    );
  }

  if (options?.onlyTo !== undefined) {
    url.searchParams.set(
      "only_to",
      String(options.onlyTo)
    );
  }

  if (options?.onlyFrom !== undefined) {
    url.searchParams.set(
      "only_from",
      String(options.onlyFrom)
    );
  }

  if (options?.minTimestamp !== undefined) {
    url.searchParams.set(
      "min_timestamp",
      String(options.minTimestamp)
    );
  }

  if (options?.maxTimestamp !== undefined) {
    url.searchParams.set(
      "max_timestamp",
      String(options.maxTimestamp)
    );
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "TRON-PRO-API-KEY": getApiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const rawResponse = await response.text();

  const responseHash = hashResponse(rawResponse);

  let data: TronGridResponse;

  try {
    data = JSON.parse(rawResponse) as TronGridResponse;
  } catch {
    throw new Error(
      `TronGrid returned invalid JSON: ${rawResponse.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `TronGrid API error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return {
    ...data,
    provenance: {
      apiCallCount: 1,
      responseHashes: [responseHash],
    },
  };
}