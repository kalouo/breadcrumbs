import BigNumber from "bignumber.js";

import { ENoteType, StepArguments } from "src/engine/interfaces";
import { getMinimumDelegationAmount } from "src/engine/helpers";
import { add } from "src/utils/math";
import { MUTEZ_FACTOR } from "src/utils/constants";

export const resolveExcludedPaymentsByMinimumDelegatorBalance = (
  args: StepArguments
): StepArguments => {
  const { config, cycleReport } = args;

  /* Convert minimum amount to mutez */
  const minimumDelegationAmount =
    getMinimumDelegationAmount(config).times(MUTEZ_FACTOR);

  const _delegatorPayments: typeof cycleReport.delegatorPayments = [];
  const _excludedPayments: typeof cycleReport.delegatorPayments = [
    ...cycleReport.excludedPayments,
  ];
  const _creditablePayments: typeof cycleReport.delegatorPayments = [];

  let _feeIncome = cycleReport.feeIncome;

  for (const payment of cycleReport.delegatorPayments) {
    if (payment.delegatorBalance.lt(minimumDelegationAmount)) {
      if (config.accounting_mode) {
        _creditablePayments.push({
          ...payment,
          transactionFee: new BigNumber(0),
          note: ENoteType.BalanceBelowMinimum,
        });
      } else {
        /* Increment fee income if payment will not be paid later */
        _feeIncome = add(_feeIncome, payment.amount);
        _excludedPayments.push({
          ...payment,
          note: ENoteType.BalanceBelowMinimum,
          fee: payment.amount,
          amount: new BigNumber(0),
          transactionFee: new BigNumber(0),
        });
      }
    } else {
      _delegatorPayments.push(payment);
    }
  }

  return {
    ...args,
    cycleReport: {
      ...cycleReport,
      feeIncome: _feeIncome,
      delegatorPayments: _delegatorPayments,
      creditablePayments: [
        ...cycleReport.creditablePayments,
        ..._creditablePayments,
      ],
      excludedPayments: _excludedPayments,
    },
  };
};
