import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [ANALYSIS] Starting CV-JD analysis request...');
    
    // Get JSON data from the request
    const requestData = await request.json();
    console.log('🔍 [ANALYSIS] Request data:', {
      hasJdText: !!requestData.jd_text,
      hasCvText: !!requestData.cv_text,
      jdLength: requestData.jd_text?.length || 0,
      cvLength: requestData.cv_text?.length || 0
    });
    
    if (!requestData.jd_text || !requestData.cv_text) {
      console.error('❌ [ANALYSIS] Missing required data');
      return NextResponse.json(
        { error: 'Both jd_text and cv_text are required' },
        { status: 400 }
      );
    }
    
    const backendUrl = getApiBaseUrl('server');
    const analysisUrl = `${backendUrl}/api/jobs/standardize-and-match-text`;
    
    console.log('🔍 [ANALYSIS] Calling backend analysis:', {
      url: analysisUrl,
      jdTextLength: requestData.jd_text.length,
      cvTextLength: requestData.cv_text.length
    });
    
    // Call backend with extended timeout
    const startTime = Date.now();
    const backendResponse = await fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      signal: AbortSignal.timeout(90000), // 90 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`🔍 [ANALYSIS] Backend response received in ${responseTime}ms:`, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      ok: backendResponse.ok
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => 'No error details');
      console.error('❌ [ANALYSIS] Backend analysis failed:', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        error: errorText
      });
      
      // Return detailed error information
      return NextResponse.json(
        { 
          error: `Backend analysis failed: ${backendResponse.status} - ${backendResponse.statusText}`,
          details: errorText,
          backend_status: backendResponse.status,
          response_time_ms: responseTime
        },
        { status: backendResponse.status }
      );
    }
    
    const analysisData = await backendResponse.json();
    console.log('✅ [ANALYSIS] Backend analysis completed successfully:', {
      responseTime: `${responseTime}ms`,
      hasData: !!analysisData,
      hasMatchResult: !!analysisData.match_result,
      hasOverallScore: !!analysisData.match_result?.overall_score
    });
    
    // Validate response structure
    if (!analysisData.match_result) {
      console.error('❌ [ANALYSIS] Invalid response structure - missing match_result');
      return NextResponse.json(
        { 
          error: 'Backend returned invalid response structure',
          details: 'Missing match_result field',
          received_data: Object.keys(analysisData)
        },
        { status: 500 }
      );
    }
    
    // Add metadata to response
    const enhancedResponse = {
      ...analysisData,
      processing_time_ms: responseTime,
      timestamp: new Date().toISOString(),
      api_version: '1.0'
    };
    
    console.log('✅ [ANALYSIS] Returning enhanced response with metadata');
    return NextResponse.json(enhancedResponse);
    
  } catch (error) {
    console.error('❌ [ANALYSIS] Unexpected error:', error);
    
    let errorMessage = 'Analysis processing failed';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'Analysis request timed out after 90 seconds';
        errorDetails = 'The backend AI analysis is taking longer than expected. This might be due to high server load or complex document processing.';
      }
    }
    
    return NextResponse.json(
      { 
        error: 'CV-JD analysis failed',
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        suggestions: [
          'Try with shorter documents',
          'Check if backend services are running',
          'Retry the analysis in a few moments'
        ]
      },
      { status: 500 }
    );
  }
} 