import Image from "next/image";

interface Props {
  title?: string;
  width: number;
  height: number;
  className?: string;
  fill?: boolean;
}

// Image placeholder component
export default function PlaceholderImage({
  title = "Placeholder",
  width = 100,
  height = 100,
  className = "",
}: Props) {
  // Generate a simple SVG placeholder with a colored background
  const svgPlaceholder = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#E0E0E0" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="16" fill="#333">
    ${title}
  </text>
</svg>
  `;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingTop: `${(height / width) * 100}%`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <Image
          src={`data:image/svg+xml;base64,${btoa(svgPlaceholder)}`}
          alt={`Placeholder for ${title}`}
          className={className}
          fill
        />
      </div>
    </div>
  );
}
