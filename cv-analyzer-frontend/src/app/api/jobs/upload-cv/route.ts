import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    console.log('📄 [CV UPLOAD] Starting CV file upload and standardization...');
    
    // Get form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('❌ [CV UPLOAD] No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log('📄 [CV UPLOAD] File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Create FormData for backend request
    const backendFormData = new FormData();
    backendFormData.append('files', file);
    
    const backendUrl = getApiBaseUrl('server');
    
    // Use the proper CV standardization endpoint for file processing
    let extractedData = null;
    try {
      if (file.type === 'text/plain') {
        // For plain text files, pass the file directly without recreating it
        const backendFormData = new FormData();
        backendFormData.append('files', file);
        
        const standardizeUrl = `${backendUrl}/api/cv/cv/upload-cv`;
        console.log('📄 [CV UPLOAD] Uploading text CV via backend:', standardizeUrl);
        
        const standardizeResponse = await fetch(standardizeUrl, {
          method: 'POST',
          body: backendFormData,
          signal: AbortSignal.timeout(120000), // Increase to 2 minutes for complex CVs
        });
        
        if (!standardizeResponse.ok) {
          const errorText = await standardizeResponse.text().catch(() => 'No error details');
          console.error('❌ [CV UPLOAD] CV standardization failed:', {
            status: standardizeResponse.status,
            statusText: standardizeResponse.statusText,
            error: errorText
          });
          throw new Error(`CV standardization failed: ${standardizeResponse.status} - ${standardizeResponse.statusText}`);
        }
        
        extractedData = await standardizeResponse.json();
      } else {
        // For non-text files, use the proper CV upload endpoint
        const standardizeUrl = `${backendUrl}/api/cv/cv/upload-cv`;
        console.log('📄 [CV UPLOAD] Processing CV file via backend:', standardizeUrl);
        
        const extractResponse = await fetch(standardizeUrl, {
          method: 'POST',
          body: backendFormData,
          signal: AbortSignal.timeout(120000), // Increase to 2 minutes for complex CVs // 60 second timeout
        });
        
        if (!extractResponse.ok) {
          const errorText = await extractResponse.text().catch(() => 'No error details');
          console.error('❌ [CV UPLOAD] CV standardization failed:', {
            status: extractResponse.status,
            statusText: extractResponse.statusText,
            error: errorText
          });
          throw new Error(`CV standardization failed: ${extractResponse.status} - ${extractResponse.statusText}`);
        }
        
        extractedData = await extractResponse.json();
        console.log('📄 [CV UPLOAD] CV processed successfully via standardize-cv endpoint');
      }
    } catch (processingError) {
      console.error('❌ [CV UPLOAD] Failed to process CV:', processingError);
      return NextResponse.json(
        { 
          error: 'Failed to process CV file',
          details: processingError instanceof Error ? processingError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    if (!extractedData) {
      console.error('❌ [CV UPLOAD] No data returned from CV processing');
      return NextResponse.json(
        { error: 'No data could be extracted from the CV file' },
        { status: 400 }
      );
    }
    
    console.log('📄 [CV UPLOAD] CV processing completed successfully');
    
    // Check for backend processing errors
    if (extractedData.error) {
      console.error('❌ [CV UPLOAD] Backend returned error:', extractedData.error);
      
      const isOpenAIError = extractedData.error.includes('OpenAI API') || extractedData.error.includes('server_error');
      
      return NextResponse.json(
        { 
          error: isOpenAIError ? 'AI processing temporarily unavailable' : 'CV processing failed',
          details: extractedData.error,
          isRetryable: isOpenAIError,
          extractedText: extractedData.extracted_text || '',
          filename: file.name
        },
        { status: 500 }
      );
    }
    
    // Return successful result directly from the standardize-cv endpoint
    console.log('✅ [CV UPLOAD] CV processed successfully:', {
      cvId: extractedData.cv_id,
      filename: extractedData.filename,
      hasStandardizedData: !!extractedData.standardized_data
    });
    
    return NextResponse.json({
      cv_id: extractedData.cv_id,
      filename: extractedData.filename || file.name,
      status: 'success',
      standardized_data: extractedData.standardized_data,
      extracted_text: extractedData.extracted_text,
      hasData: true,
      hasStandardizedData: !!extractedData.standardized_data,
      processing_method: extractedData.processing_method || 'standardized_gpt'
    });
    
  } catch (error) {
    console.error('❌ [CV UPLOAD] Unexpected error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'CV upload processing failed',
        message: errorMessage
      },
      { status: 500 }
    );
  }
} 