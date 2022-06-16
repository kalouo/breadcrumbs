/* eslint @typescript-eslint/no-var-requires: "off" */

import { OpKind, TezosToolkit, WalletParamsWithKind } from "@taquito/taquito";
import { BreadcrumbsConfiguration } from "src/config/interfaces";
import { BasePayment } from "src/engine/interfaces";
import { getSigner } from "./signers";

require("dotenv").config();

export const createProvider = async (config: BreadcrumbsConfiguration) => {
  const RPC_URL = config.network_configuration?.rpc;
  if (RPC_URL === undefined) throw Error("No RPC URL given");
  const tezos = new TezosToolkit(RPC_URL);
  tezos.setProvider({ signer: await getSigner(config) });
  return tezos;
};

export const prepareTransaction = (
  payment: BasePayment
): WalletParamsWithKind => {
  return {
    kind: OpKind.TRANSACTION,
    to: payment.recipient,
    amount: payment.amount.toNumber(),
    mutez: true,
  };
};

export const submitBatch = async (
  tezos: TezosToolkit,
  payments: WalletParamsWithKind[]
): Promise<string> => {
  console.log("Submitting batch");
  const batch = tezos.wallet.batch(payments);
  const operation = await batch.send();
  await operation.confirmation(2);
  console.log(
    `Transaction confirmed on https://ithacanet.tzkt.io/${operation.opHash}`
  );
  return operation.opHash;
};
