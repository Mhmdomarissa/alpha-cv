import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[Debug] Testing internal API access...');
    
    // Test calling our own list-cvs proxy
    const cvsUrl = 'http://localhost:3000/api/jobs/list-cvs';
    console.log(`[Debug] Calling: ${cvsUrl}`);
    
    const response = await fetch(cvsUrl);
    console.log(`[Debug] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Debug] Error response: ${errorText}`);
      return NextResponse.json({ 
        error: 'Failed to call proxy', 
        status: response.status,
        errorText 
      });
    }
    
    const data = await response.json();
    console.log(`[Debug] Success! Got ${data.cvs?.length || 0} CVs`);
    
    return NextResponse.json({ 
      success: true, 
      cvsCount: data.cvs?.length || 0,
      message: 'Debug test successful' 
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Debug] Exception:', error);
    return NextResponse.json({ 
      error: 'Exception occurred', 
      message: errorMessage,
      stack: errorStack 
    }, { status: 500 });
  }
}