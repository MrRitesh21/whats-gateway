"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Send, Sparkles } from "lucide-react";
import type { LeadForm } from "@/lib/forms/types";

export default function PublicFormPage() {
    const params = useParams();
    const formId = params?.formId as string;

    const [form, setForm] = useState<LeadForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ message: string; outreachSent?: boolean; outreachStatus?: "PENDING" | "SENT" | "FAILED" | "DISABLED" } | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!formId) return;
        fetch(`/api/forms/${formId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.status && data.data?.form) {
                    setForm(data.data.form);
                    // Initialize default form fields
                    const initial: Record<string, string> = {};
                    data.data.form.fields.forEach((f: any) => {
                        initial[f.id] = f.defaultValue || "";
                    });
                    setFormData(initial);
                } else {
                    setError(data.message || "Form not found");
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load form");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [formId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form) return;

        setValidationError(null);

        // Verify required fields
        for (const field of form.fields) {
            if (field.required && !formData[field.id]?.trim()) {
                setValidationError(`"${field.label}" is required.`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/forms/${form.id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const result = await res.json();

            if (result.status) {
                setSubmitted(true);
                setSubmitResult({
                    message: result.message || form.successMessage,
                    outreachSent: result.outreachSent,
                    outreachStatus: result.outreachStatus,
                });
                if (result.redirectUrl) {
                    setTimeout(() => {
                        window.top ? (window.top.location.href = result.redirectUrl) : (window.location.href = result.redirectUrl);
                    }, 1500);
                }
            } else {
                setValidationError(result.message || "Failed to submit form");
            }
        } catch (err: any) {
            setValidationError(err.message || "Network error occurred while submitting");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                    <span>Loading form...</span>
                </div>
            </div>
        );
    }

    if (error || !form) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
                    <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Form Unavailable</h2>
                    <p className="text-sm text-slate-500 mt-1">{error || "This form does not exist or has been disabled."}</p>
                </div>
            </div>
        );
    }

    // Theme definitions
    const getThemeWrapperClass = () => {
        switch (form.theme) {
            case "dark":
                return "bg-slate-950 text-slate-100 dark";
            case "slate":
                return "bg-slate-100 text-slate-800";
            case "indigo":
                return "bg-indigo-50/50 text-slate-900";
            case "minimal":
                return "bg-transparent text-slate-900";
            case "custom":
                return "form-custom-root";
            case "emerald":
            default:
                return "bg-emerald-50/30 text-slate-900";
        }
    };

    const getCardClass = () => {
        switch (form.theme) {
            case "dark":
                return "bg-slate-900 border-slate-800 text-slate-100 shadow-2xl";
            case "minimal":
                return "bg-transparent border-0 shadow-none p-0";
            case "slate":
                return "bg-white border-slate-200 shadow-md";
            case "indigo":
                return "bg-white border-indigo-100 shadow-xl shadow-indigo-500/5";
            case "custom":
                return "form-custom-card";
            case "emerald":
            default:
                return "bg-white border-slate-200/80 shadow-xl shadow-emerald-500/5";
        }
    };

    const getButtonBg = () => {
        if (form.brandColor) return form.brandColor;
        switch (form.theme) {
            case "indigo": return "#6366f1";
            case "dark": return "#10b981";
            default: return "#10b981";
        }
    };

    return (
        <div className={`min-h-screen py-8 px-4 flex items-center justify-center transition-colors duration-200 ${getThemeWrapperClass()}`}>
            {/* Custom CSS Injected by the user */}
            {form.customCss && (
                <style dangerouslySetInnerHTML={{ __html: form.customCss }} />
            )}

            <div
                className={`w-full max-w-lg rounded-2xl border p-6 sm:p-8 transition-all ${getCardClass()}`}
                style={{
                    borderRadius: form.borderRadius !== undefined ? `${form.borderRadius}px` : undefined,
                    backgroundColor: form.theme === "custom" ? form.backgroundColor : undefined,
                    color: form.theme === "custom" ? form.textColor : undefined,
                }}
            >
                {submitted ? (
                    <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-50 dark:ring-emerald-900/30">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Inquiry Received!</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                            {submitResult?.message}
                        </p>
                        {submitResult?.outreachSent ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                                WhatsApp follow-up sent.
                            </div>
                        ) : submitResult?.outreachStatus === "PENDING" ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-700 dark:text-amber-300">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                Inquiry saved; WhatsApp follow-up is processing.
                            </div>
                        ) : null}
                        <div className="pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setSubmitted(false);
                                    setFormData({});
                                }}
                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                            >
                                Submit another response
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5 form-element">
                        {/* Header */}
                        <div className="space-y-1.5 form-header">
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white form-title">
                                {form.title}
                            </h1>
                            {form.description && (
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 form-description">
                                    {form.description}
                                </p>
                            )}
                        </div>

                        {validationError && (
                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{validationError}</span>
                            </div>
                        )}

                        {/* Fields */}
                        <div className="space-y-4 form-fields-container">
                            {form.fields.map((field) => (
                                <div key={field.id} className="space-y-1.5 form-group">
                                    <label
                                        htmlFor={field.id}
                                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 form-label"
                                    >
                                        {field.label}
                                        {field.required && <span className="text-rose-500 ml-1">*</span>}
                                    </label>

                                    {field.type === "textarea" ? (
                                        <textarea
                                            id={field.id}
                                            name={field.id}
                                            rows={3}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition form-input form-textarea"
                                        />
                                    ) : field.type === "select" ? (
                                        <select
                                            id={field.id}
                                            name={field.id}
                                            required={field.required}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition form-input form-select"
                                        >
                                            <option value="">Select an option...</option>
                                            {field.options?.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type}
                                            id={field.id}
                                            name={field.id}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ""}
                                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition form-input"
                                        />
                                    )}

                                    {field.helpText && (
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 form-help">
                                            {field.helpText}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{ backgroundColor: getButtonBg() }}
                            className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 form-button"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    <span>{form.submitButtonText || "Submit"}</span>
                                </>
                            )}
                        </button>

                        {/* Optional subtle branding */}
                        <div className="text-center pt-2">
                            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                                <span>Secured with WhatsApp Direct Connect</span>
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
