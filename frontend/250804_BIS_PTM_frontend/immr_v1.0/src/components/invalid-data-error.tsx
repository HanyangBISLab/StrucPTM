interface Props {
  title?: string;
  message?: string;
}

// 데이터 오류시 표시되는 메시지 박스
export default function ErrorMessageBox({
  title = "Invalid data",
  message = "The data contained in the response is invalid",
}: Props) {
  return (
    <div className="grid size-full place-content-center bg-gray-50 p-6 text-gray-500">
      <p className="text-center font-semibold">{title}</p>
      <p className="text-xs">{message}</p>
    </div>
  );
}
