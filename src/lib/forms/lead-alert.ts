export interface FormLeadAlertInput {
    userId: string;
    formTitle: string;
    name: string;
}

export function buildFormLeadAlert(input: FormLeadAlertInput) {
    return {
        userId: input.userId,
        title: "New form lead",
        message: `${input.name.trim() || "A new lead"} submitted "${input.formTitle.trim() || "your form"}". Open Lead Forms to review it.`,
        type: "SUCCESS",
        href: "/dashboard/lead-forms",
        read: false,
    };
}
