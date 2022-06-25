/** @jest-environment setup-polly-jest/jest-environment-node */
import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";

import client from "src/api-client";
import * as Polly from "test/helpers/polly";

import { generateConfig } from "test/helpers";
import { initializeCycleReport } from "src/engine/helpers";
import engine from "src/engine";
import { subtract, sum } from "src/utils/math";

import {
  resolveBakerRewards,
  resolveDelegatorRewards,
  resolveExcludedDelegators,
  resolveExcludedPaymentsByMinimumAmount,
} from "src/engine/steps";

describe("sequential run", () => {
  Polly.start();
  it("correctly runs steps in a sequence (one step)", async () => {
    const config = generateConfig();

    const cycleData = await client.getCycleData(config.baking_address, 470);
    const { cycleRewards, cycleDelegatedBalance, cycleStakingBalance } =
      cycleData;

    const args = {
      config,
      cycleData,
      cycleReport: initializeCycleReport(470),
      distributableRewards: cycleRewards,
      tezos: {} as TezosToolkit,
    };

    const output = await engine.run(args, [resolveBakerRewards]);

    const bakerBalance = subtract(cycleStakingBalance, cycleDelegatedBalance);

    const lockedBondRewards = bakerBalance
      .div(cycleStakingBalance)
      .times(cycleRewards)
      .dp(0, BigNumber.ROUND_DOWN);

    const distributableRewards =
      args.distributableRewards.minus(lockedBondRewards);

    const expected = {
      ...args,
      cycleReport: {
        ...args.cycleReport,
        lockedBondRewards,
      },
      distributableRewards,
    };

    expect(output).toStrictEqual(expected);
    expect(
      output.distributableRewards.plus(output.cycleReport.lockedBondRewards)
    ).toStrictEqual(output.cycleData.cycleRewards);
  });

  it("correctly runs steps in a sequence (two steps)", async () => {
    const excludedAddresses = [];
    const config = generateConfig({
      overdelegation: { excluded_addresses: excludedAddresses },
    });

    const cycleData = await client.getCycleData(config.baking_address, 470);

    const args = {
      config,
      cycleData,
      cycleReport: initializeCycleReport(470),
      distributableRewards: cycleData.cycleRewards,
      tezos: {} as TezosToolkit,
    };

    const output = await engine.run(args, [
      resolveBakerRewards,
      resolveExcludedDelegators,
    ]);
    const expected = await engine.run(args, [resolveBakerRewards]);

    expect(output).toStrictEqual(expected);
  });

  it("correctly runs steps in a sequence (three steps)", async () => {
    const config = generateConfig();

    const cycleData = await client.getCycleData(config.baking_address, 470);
    const { cycleRewards, cycleDelegatedBalance, cycleStakingBalance } =
      cycleData;

    const args = {
      config,
      cycleData,
      cycleReport: initializeCycleReport(470),
      distributableRewards: cycleRewards,
      tezos: {} as TezosToolkit,
    };

    const input = await engine.run(args, [
      resolveBakerRewards,
      resolveExcludedDelegators,
    ]);

    const output = await engine.run(args, [
      resolveBakerRewards,
      resolveExcludedDelegators,
      resolveDelegatorRewards,
    ]);

    const delegatorShareOfRewards = sum(
      ..._.map(input.cycleData.cycleShares, (share) =>
        input.distributableRewards.times(
          share.balance.div(cycleDelegatedBalance)
        )
      )
    );

    const percentageFee = new BigNumber(config.default_fee).div(100);
    const delegatorTotal = new BigNumber(1)
      .minus(percentageFee)
      .times(delegatorShareOfRewards)
      .dp(0, BigNumber.ROUND_DOWN);

    const feeIncomeTotal = new BigNumber(config.default_fee)
      .div(100)
      .times(delegatorShareOfRewards)
      .dp(0, BigNumber.ROUND_DOWN);

    const ROUNDING_ADJUSTMENT_1 = 5;
    expect(output.cycleReport.feeIncome).toStrictEqual(
      feeIncomeTotal.minus(ROUNDING_ADJUSTMENT_1)
    );

    const ROUNDING_ADJUSTMENT_2 = 7;
    expect(output.distributableRewards).toStrictEqual(
      input.distributableRewards
        .minus(feeIncomeTotal)
        .minus(delegatorTotal)
        .plus(ROUNDING_ADJUSTMENT_2)
    );

    _.each(output.cycleReport.delegatorPayments, (payment) => {
      const share = _.find(
        output.cycleData.cycleShares,
        (share) => share.address === payment.delegator
      );

      expect(payment.bakerStakingBalance).toEqual(cycleStakingBalance);
      expect(payment.cycle).toEqual(input.cycleReport.cycle);
      expect(payment.delegator).toEqual(share?.address);
      expect(payment.delegatorBalance).toEqual(share?.balance);
      expect(payment.bakerCycleRewards).toEqual(cycleRewards);

      expect(payment.recipient).toEqual(
        config.delegator_overrides?.[payment.delegator]?.recipient ??
          payment.delegator
      );

      expect(payment.feeRate).toStrictEqual(
        new BigNumber(
          config.delegator_overrides?.[payment.delegator]?.fee ??
            config.default_fee
        ).div(100)
      );

      const expectedPaymentAmount = share?.balance
        .div(input.cycleData.cycleDelegatedBalance)
        .times(input.distributableRewards)
        .times(
          new BigNumber(100)
            .minus(
              config.delegator_overrides?.[payment.delegator]?.fee ??
                config.default_fee
            )
            .dividedBy(100)
        )
        .dp(0, BigNumber.ROUND_DOWN);

      expect(payment.amount).toStrictEqual(expectedPaymentAmount);
    });

    expect(output.cycleReport.delegatorPayments).toHaveLength(
      input.cycleData.cycleShares.length
    );
  });

  it("correctly runs steps in a sequence (four steps)", async () => {
    const config = generateConfig();

    const cycleData = await client.getCycleData(config.baking_address, 470);
    const { cycleRewards } = cycleData;

    const args = {
      config,
      cycleData,
      cycleReport: initializeCycleReport(470),
      distributableRewards: cycleRewards,
      tezos: {} as TezosToolkit,
    };

    const input = await engine.run(args, [
      resolveBakerRewards,
      resolveExcludedDelegators,
      resolveDelegatorRewards,
    ]);

    const output = await engine.run(args, [
      resolveBakerRewards,
      resolveExcludedDelegators,
      resolveDelegatorRewards,
      resolveExcludedPaymentsByMinimumAmount,
    ]);

    expect(output).toStrictEqual(input);
  });
});
