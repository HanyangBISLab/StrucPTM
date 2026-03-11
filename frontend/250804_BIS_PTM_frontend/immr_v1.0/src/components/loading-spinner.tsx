import { LoadingOutlined } from "@ant-design/icons";
import { Spin } from "antd";

export default function LoadingSpinner() {
  return <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />;
}
