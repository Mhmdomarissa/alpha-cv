import { NextRequest, NextResponse } from 'next/server';

/**
 * Database Embeddings API Route - Proxy to Backend
 * GET /api/jobs/database/embeddings
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    
    console.log('🔍 [DATABASE EMBEDDINGS] Proxying to backend:', `${backendUrl}/database/embeddings`);
    
    const response = await fetch(`${backendUrl}/api/database/embeddings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ [DATABASE EMBEDDINGS] Backend error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Backend database embeddings check failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [DATABASE EMBEDDINGS] Backend response received');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [DATABASE EMBEDDINGS] Request failed:', error);
    return NextResponse.json(
      { error: 'Failed to check database embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
