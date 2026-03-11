import { ChildrenOnly } from "@/types";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntDApp, ConfigProvider, ThemeConfig } from "antd";

const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#479BB8",
  },
};

// Provider를 모아놓은 컴포넌트
// Ant Design의 ConfigProvider를 사용하여 테마를 설정하고, 전역적으로 적용할 수 있도록 함
export default function Providers({ children }: ChildrenOnly) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme} componentSize="middle">
        <AntDApp className="h-full">{children}</AntDApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
