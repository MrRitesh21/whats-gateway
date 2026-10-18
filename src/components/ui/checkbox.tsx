"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
    ({ className, checked = false, onCheckedChange, disabled, onClick, ...props }, ref) => {
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                data-state={checked ? "checked" : "unchecked"}
                disabled={disabled}
                ref={ref}
                onClick={(e) => {
                    onClick?.(e);
                    if (!disabled && onCheckedChange) {
                        onCheckedChange(!checked);
                    }
                }}
                className={cn(
                    "peer h-4 w-4 shrink-0 rounded-[4px] border border-primary/40 shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    checked
                        ? "bg-primary text-primary-foreground border-primary flex items-center justify-center"
                        : "bg-background border-input hover:border-primary/60",
                    className
                )}
                {...props}
            >
                {checked && (
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3 text-white"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </button>
        );
    }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };