import Link from "next/link";

type Props = {
  title: string;
  reasons: string[]; // one line for each reason that applies
  action: string;
};

// Suggests a new analysis. Same look as the plot-level note above the indicators.
export default function RefreshNotice({ title, reasons, action }: Props) {
  return (
    <div
      role="status"
      className="mt-4 rounded-card border border-caution-500/40 bg-caution-50 p-4 text-sm leading-7 text-caution-700"
    >
      <p className="font-bold">{title}</p>
      {reasons.length === 1 ? (
        <p>{reasons[0]}</p>
      ) : (
        <ul className="list-disc ps-5">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <Link href="/select-plot" className="mt-2 inline-block font-semibold underline">
        {action}
      </Link>
    </div>
  );
}
