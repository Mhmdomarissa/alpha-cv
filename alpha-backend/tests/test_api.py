#!/usr/bin/env python3
"""
Comprehensive test script for CV Analysis API
"""

import requests
import json
import os
from pathlib import Path

# API base URL
BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing Health Check...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_upload_files():
    """Test file upload endpoint"""
    print("\n📤 Testing File Upload...")
    
    # Create a sample PDF file for testing
    sample_pdf_path = "sample_cv.pdf"
    
    # Check if sample file exists, if not create a dummy one
    if not os.path.exists(sample_pdf_path):
        print("⚠️  No sample PDF found. Creating a dummy file for testing...")
        # Create a simple PDF for testing
        try:
            from fpdf import FPDF
            pdf = FPDF()
            pdf.add_page()
            pdf.set_font("Arial", size=12)
            pdf.cell(200, 10, txt="Sample CV - John Doe", ln=1, align='C')
            pdf.cell(200, 10, txt="Software Engineer", ln=1, align='C')
            pdf.cell(200, 10, txt="Email: john.doe@example.com", ln=1, align='L')
            pdf.cell(200, 10, txt="Phone: +1-555-0123", ln=1, align='L')
            pdf.cell(200, 10, txt="Skills: Python, JavaScript, React", ln=1, align='L')
            pdf.output(sample_pdf_path)
            print("✅ Created sample PDF for testing")
        except Exception as e:
            print(f"❌ Failed to create sample PDF: {e}")
            return False
    
    try:
        with open(sample_pdf_path, 'rb') as f:
            files = {'files': (sample_pdf_path, f, 'application/pdf')}
            response = requests.post(f"{BASE_URL}/upload/", files=files)
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Upload Result: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Upload failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Upload test failed: {e}")
        return False

def test_search_cvs():
    """Test search endpoints"""
    print("\n🔍 Testing Search...")
    
    # Test search by description
    try:
        response = requests.post(
            f"{BASE_URL}/search/search",
            params={"description": "software engineer", "top_k": 3}
        )
        print(f"Search Status: {response.status_code}")
        if response.status_code == 200:
            results = response.json()
            print(f"Search Results: {json.dumps(results, indent=2)}")
        else:
            print(f"❌ Search failed: {response.text}")
    except Exception as e:
        print(f"❌ Search test failed: {e}")
    
    # Test list all CVs
    try:
        response = requests.get(f"{BASE_URL}/search/cvs")
        print(f"List CVs Status: {response.status_code}")
        if response.status_code == 200:
            results = response.json()
            print(f"Total CVs: {len(results)}")
        else:
            print(f"❌ List CVs failed: {response.text}")
    except Exception as e:
        print(f"❌ List CVs test failed: {e}")

def test_export_cvs():
    """Test export endpoints"""
    print("\n📥 Testing Export...")
    
    # Test CSV export
    try:
        response = requests.get(f"{BASE_URL}/export/export?format=csv")
        print(f"CSV Export Status: {response.status_code}")
        if response.status_code == 200:
            with open("exported_cvs.csv", "wb") as f:
                f.write(response.content)
            print("✅ CSV exported successfully")
        else:
            print(f"❌ CSV export failed: {response.text}")
    except Exception as e:
        print(f"❌ CSV export test failed: {e}")
    
    # Test PDF export
    try:
        response = requests.get(f"{BASE_URL}/export/export?format=pdf")
        print(f"PDF Export Status: {response.status_code}")
        if response.status_code == 200:
            with open("exported_cvs.pdf", "wb") as f:
                f.write(response.content)
            print("✅ PDF exported successfully")
        else:
            print(f"❌ PDF export failed: {response.text}")
    except Exception as e:
        print(f"❌ PDF export test failed: {e}")

def test_error_handling():
    """Test error handling"""
    print("\n⚠️  Testing Error Handling...")
    
    # Test invalid file upload
    try:
        files = {'files': ('test.txt', b'This is not a PDF', 'text/plain')}
        response = requests.post(f"{BASE_URL}/upload/", files=files)
        print(f"Invalid file upload status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Properly rejected invalid file type")
        else:
            print(f"❌ Should have rejected invalid file: {response.text}")
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
    
    # Test empty search
    try:
        response = requests.post(f"{BASE_URL}/search/search", params={"description": ""})
        print(f"Empty search status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Properly rejected empty search")
        else:
            print(f"❌ Should have rejected empty search: {response.text}")
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting CV Analysis API Tests")
    print("=" * 50)
    
    # Test health check
    health_ok = test_health_check()
    
    if health_ok:
        # Test upload
        upload_ok = test_upload_files()
        
        if upload_ok:
            # Test search
            test_search_cvs()
            
            # Test export
            test_export_cvs()
        
        # Test error handling
        test_error_handling()
    else:
        print("❌ API is not responding. Please check if the server is running.")
    
    print("\n" + "=" * 50)
    print("🏁 Testing completed!")

if __name__ == "__main__":
    main() 