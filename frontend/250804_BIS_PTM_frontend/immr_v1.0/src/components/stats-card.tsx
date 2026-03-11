interface Props {
  label: string;
  value: number | string;
}

// 통계 값을 보여주는 카드
export default function StatsCard({ label, value }: Props) {
  return (
    <div className="flex w-full flex-col items-center rounded-sm bg-[#EBF8FA] p-3">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-secondary ">{label}</span>
    </div>
  );
}
