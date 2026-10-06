import { Fragment } from "react";

/**
 * Splits a headline into words so the scroll engine can reveal them one by one.
 * Wrap a word in asterisks for a heavier-weight emphasis: "before its *next* transaction."
 * Punctuation after the closing asterisk stays upright.
 */
export function Words({ text }: { text: string }) {
  const tokens = text.split(" ");
  return (
    <>
      {tokens.map((tok, i) => {
        const m = /^\*([^*]+)\*(.*)$/.exec(tok);
        return (
          <Fragment key={i}>
            <span className="word-mask">
              <span className="word">
                {m ? (
                  <>
                    <span className="emph">{m[1]}</span>
                    {m[2]}
                  </>
                ) : (
                  tok
                )}
              </span>
            </span>
            {i < tokens.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </>
  );
}
