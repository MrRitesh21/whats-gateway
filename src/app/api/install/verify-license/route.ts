import { NextRequest, NextResponse } from "next/server";
import { verifyAndSaveLicense } from "@/lib/license";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { purchase_code, customer_name, customer_email, domain } = body;

    const result = await verifyAndSaveLicense({
      purchase_code,
      customer_name: customer_name || 'Administrator',
      customer_email: customer_email || 'admin@webotapp.com',
      domain: domain || (req.headers.get('host') || 'localhost')
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      license: result.data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Verification failed' }, { status: 500 });
  }
}
