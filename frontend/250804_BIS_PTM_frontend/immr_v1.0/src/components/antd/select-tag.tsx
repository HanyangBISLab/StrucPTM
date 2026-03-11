import { cn } from "@/lib/utils";
import { Tag, TagProps } from "antd";

interface Props extends TagProps {
  selected?: boolean;
}

export default function PrimaryTag({ selected = false, ...props }: Props) {
  return (
    <Tag
      {...props}
      className={cn(
        "",
        selected ? "bg-selected border-primary-light text-primary" : ""
      )}
    />
  );
}
