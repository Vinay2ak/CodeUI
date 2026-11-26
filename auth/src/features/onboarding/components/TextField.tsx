import { forwardRef } from "react";
import { Input, type InputProps } from "../../../components/ui/input";

export type TextFieldProps = InputProps;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  return <Input ref={ref} {...props} />;
});

TextField.displayName = "TextField";
