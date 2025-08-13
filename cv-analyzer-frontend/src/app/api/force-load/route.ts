import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

const BACKEND_URL = getApiBaseUrl();

export async function GET() {
  try {
    console.log('[Force Load] Directly calling backend...');
    
    // Call backend directly - no proxy nonsense
    const [cvsResponse, jdsResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/api/jobs/list-cvs`).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/jobs/list-jds`).then(r => r.json())
    ]);
    
    const cvs = cvsResponse.cvs || [];
    const jds = jdsResponse.jds || [];
    
    console.log(`[Force Load] SUCCESS: ${cvs.length} CVs, ${jds.length} JDs`);
    
    return NextResponse.json({
      success: true,
      cvs,
      jds,
      counts: { cvs: cvs.length, jds: jds.length }
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Force Load] ERROR:', error);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      cvs: [],
      jds: [],
      counts: { cvs: 0, jds: 0 }
    }, { status: 500 });
  }
}