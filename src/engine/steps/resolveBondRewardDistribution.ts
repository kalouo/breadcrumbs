import _ from "lodash";
import { SimplePayment, StepArguments } from "src/engine/interfaces";
import { divide, multiply, integerize } from "src/utils/math";

const resolveBondRewardDistribution = (args: StepArguments): StepArguments => {
  const {
    config,
    cycleReport: { lockedBondRewards },
  } = args;

  const skip = _.isEmpty(config.bond_reward_recipients);

  if (skip) {
    return args;
  } else {
    const payments: SimplePayment[] = [];
    for (const recipient in config.bond_reward_recipients) {
      const share = divide(config.bond_reward_recipients[recipient], 1);
      const payable = integerize(multiply(share, lockedBondRewards));

      const payment = {
        cycle: args.cycleReport.cycle,
        recipient,
        amount: payable,
        hash: "",
      };

      payments.push(payment);
    }
    return {
      ...args,
      cycleReport: { ...args.cycleReport, bondRewardPayments: payments },
    };
  }
};

export default resolveBondRewardDistribution;