import type { Gstr1Draft } from "@cortex/shared";

const GST_RATE = 0.05;

export function buildGstr1Draft(args: { period: string; taxableValue: number }): Gstr1Draft {
  const tax = Math.round(args.taxableValue * GST_RATE);
  return {
    period: args.period,
    taxable_value: args.taxableValue,
    tax,
    export_url: `/api/cortex/accounts/gstr1/${args.period}.json`,
  };
}
