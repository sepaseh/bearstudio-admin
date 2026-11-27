import { Avatar, Tooltip } from "antd";

type ImageThumbnailProps = {
  label: string;
  src: string;
  thumbnailSrc?: string;
};

export const ImageThumbnail = ({
  label,
  src,
  thumbnailSrc = src,
}: ImageThumbnailProps) => (
  <Tooltip
    title={<Avatar alt="" shape="square" size={200} src={src} />}
    trigger={["hover", "focus"]}
  >
    <span
      aria-label={label}
      role="img"
      style={{ display: "inline-block" }}
      tabIndex={0}
    >
      <Avatar
        shape="square"
        size={32}
        src={<img alt="" loading="lazy" src={thumbnailSrc} />}
      />
    </span>
  </Tooltip>
);
