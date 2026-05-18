import { Children, isValidElement, useEffect, useMemo } from "react";

const DEFAULT_TITLE = "AI Accountant";

export const Helmet = ({ children }) => {
  const title = useMemo(() => {
    let nextTitle = "";

    Children.forEach(children, (child) => {
      if (!isValidElement(child) || child.type !== "title") return;

      const value = child.props.children;
      if (typeof value === "string") {
        nextTitle = value;
      } else if (Array.isArray(value)) {
        nextTitle = value.filter((part) => typeof part === "string").join("");
      }
    });

    return nextTitle.trim();
  }, [children]);

  useEffect(() => {
    if (!title) return undefined;

    const previousTitle = document.title;
    document.title = title;

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
    };
  }, [title]);

  return null;
};

export default Helmet;
