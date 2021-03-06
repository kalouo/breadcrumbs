import Joi from "joi";
import { values, sum } from "lodash";
import { EPayoutWalletMode } from "../interfaces";
import { isAddress, isPKH } from "./helpers";

const validPKH = Joi.custom((i) => {
  if (isPKH(i)) return i;
  else throw Error("input must be a valid public key hash");
});

const validAddress = Joi.custom((i) => {
  if (isAddress(i)) return i;
  else throw Error("input must be a valid address");
});

const validPercentage = Joi.number().min(0).max(100);

const validPayoutWalletMode = Joi.string().valid(
  EPayoutWalletMode.Ledger,
  EPayoutWalletMode.LocalPrivateKey,
  EPayoutWalletMode.RemoteSigner
);

const validOverdelegationExcludedAddresses = Joi.array().items(validAddress);

const validDelegatorOverrides = Joi.object().pattern(
  validAddress,
  Joi.object({ fee: validPercentage, recipient: validAddress })
);

const validDistributionShares = Joi.custom((i) => {
  const result = Joi.object()
    .pattern(validAddress, validPercentage)
    .validate(i);
  if (result.error) {
    throw Error(result.error.message);
  } else {
    if (sum(values(i)) == 100) return i;
    else throw Error("sum of distribution shares must equal 100%");
  }
});

const validRpcUrl = Joi.string().uri({ scheme: ["https"] });

const validPlugin = Joi.object({
  type: Joi.string().required().valid("telegram", "discord"),
  messageTemplate: Joi.string(),
  /* DISCORD */
  webhook: Joi.any().when("type", {
    is: "discord",
    then: Joi.string()
      .uri({
        scheme: ["https", "http"],
      })
      .required(),
  }),

  /* TELEGRAM */
  chat_id: Joi.any().when("type", {
    is: "telegram",
    then: Joi.number().required(),
  }),
  api_token: Joi.any().when("type", {
    is: "telegram",
    then: Joi.string().required(),
  }),
});

export const schema = Joi.object({
  baking_address: validPKH.required(),
  default_fee: validPercentage.required(),
  payout_wallet_mode: validPayoutWalletMode.required(),
  delegator_overrides: validDelegatorOverrides,
  delegator_requirements: {
    minimum_balance: Joi.number().positive(),
  },
  income_recipients: {
    bond_rewards: validDistributionShares,
    fee_income: validDistributionShares,
  },
  network_configuration: {
    rpc_url: validRpcUrl.required(),
    suppress_KT_payments: Joi.boolean(),
    explorer_url_template: Joi.string(),
  },
  overdelegation: {
    excluded_addresses: validOverdelegationExcludedAddresses,
    guard: Joi.boolean(),
  },
  payment_requirements: {
    baker_pays_transaction_fee: Joi.boolean(),
    minimum_amount: Joi.number().positive(),
  },
  notifications: Joi.array().items(validPlugin),
});

export const validRemoteSignerUrl = Joi.string().uri({
  scheme: ["https", "http", "tcp"],
});

export const remoteSignerSchema = Joi.object({
  public_key: Joi.string().custom((value) => isPKH(value)),
  url: validRemoteSignerUrl,
});
