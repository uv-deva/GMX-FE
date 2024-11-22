import "./SearchInput.scss";
import { t } from "@lingui/macro";
import searchIcon from "img/search.svg";
import { useMedia } from "react-use";
import cx from "classnames";

type Props = {
  value: string;
  setValue: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
  placeholder?: string;
  size?: "s" | "m";
  /**
   * If not provided, will be set to true on small screens
   */
  autoFocus?: boolean;
  qa?: string;
};

const STYLE = {
  backgroundImage: `url(${searchIcon})`,
};

export default function SearchInput({
  value,
  setValue,
  onKeyDown,
  className,
  placeholder,
  autoFocus,
  size = "m",
  qa = "token-search-input",
}: Props) {
  const isSmallerScreen = useMedia("(max-width: 700px)");
  const classNames = cx("Search-input", `Search-input_size_${size}`, className);
  return (
    <div className={classNames}>
      <input
        data-qa={qa}
        type="text"
        placeholder={placeholder ?? t`Search Token`}
        value={value}
        onChange={setValue}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus ?? !isSmallerScreen}
        className="Tokenselector-search-input"
        style={STYLE}
      />
    </div>
  );
}
