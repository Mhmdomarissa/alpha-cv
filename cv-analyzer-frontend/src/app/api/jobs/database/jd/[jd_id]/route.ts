import { NextRequest, NextResponse } from 'next/server';

/**
 * Database JD Details API Route - Proxy to Backend
 * GET /api/jobs/database/jd/[jd_id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jd_id: string } }
) {
  try {
    const { jd_id } = params;
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    
    console.log('🔍 [DATABASE JD] Proxying to backend:', `${backendUrl}/database/jd/${jd_id}`);
    
    const response = await fetch(`${backendUrl}/api/database/jd/${jd_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [DATABASE JD] Backend error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend database JD check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [DATABASE JD] Backend response received for JD:', jd_id);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [DATABASE JD] Request failed:', error);
    return NextResponse.json(
      { error: 'Failed to check JD in database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
