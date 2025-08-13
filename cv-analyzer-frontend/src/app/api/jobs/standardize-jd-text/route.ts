import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    console.log('📋 [JD TEXT] Starting JD text standardization...');
    
    // Get JSON data from the request
    const { content } = await request.json();
    
    if (!content || typeof content !== 'string') {
      console.error('❌ [JD TEXT] No text content provided');
      return NextResponse.json(
        { error: 'No text content provided' },
        { status: 400 }
      );
    }
    
    console.log('📋 [JD TEXT] Text content length:', content.length);
    
    // Create a fake file-like object for the backend
    const fakeFile = new Blob([content], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', fakeFile, 'job_description.txt');
    
    const backendUrl = getApiBaseUrl('server');
    const targetUrl = `${backendUrl}/api/jobs/standardize-jd`;
    
    console.log('📋 [JD TEXT] Calling backend:', targetUrl);
    
    // Forward request to backend
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('❌ [JD TEXT] Backend response failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: targetUrl
      });
      
      return NextResponse.json(
        { 
          error: `JD text processing failed: ${response.status} - ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('✅ [JD TEXT] Backend processing completed successfully');
    console.log('📋 [JD TEXT] Response preview:', {
      hasStandardizedData: !!data.standardized_data,
      jdId: data.jd_id,
      filename: data.filename
    });
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('❌ [JD TEXT] Unexpected error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'JD text processing failed',
        message: errorMessage
      },
      { status: 500 }
    );
  }
} 