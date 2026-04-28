import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes
} from "react";

function classNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("regal-card", className)} {...props} />;
}

export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={classNames("btn-regal", className)} {...props} />;
}

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={classNames("badge-gold", className)} {...props} />;
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classNames("regal-input", className)} {...props} />;
}
