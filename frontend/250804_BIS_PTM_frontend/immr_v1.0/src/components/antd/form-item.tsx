import { cn } from "@/lib/utils";
import { ChildrenOnly } from "@/types";
import { Form, FormItemProps } from "antd";

interface Props extends FormItemProps {
  children: ChildrenOnly["children"];
}

export default function FormItem({ children, className, ...props }: Props) {
  return (
    <Form.Item {...props} className={cn("", className)}>
      {children}
    </Form.Item>
  );
}
