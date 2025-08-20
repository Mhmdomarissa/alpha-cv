#!/usr/bin/env python3
"""
Test script to verify the complete CV analyzer workflow
"""
import requests
import json
import time
import os

# Configuration
API_BASE = "http://localhost:8000"
TIMEOUT = 30

def test_health():
    """Test if the API is running"""
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API Health Check: PASSED")
            return True
        else:
            print(f"❌ API Health Check: FAILED - Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API Health Check: FAILED - {e}")
        return False

def test_jd_upload():
    """Test JD upload with text"""
    test_jd = """
    Senior Software Developer
    
    We are looking for a Senior Software Developer with expertise in Python, FastAPI, and machine learning.
    The ideal candidate should have experience with vector databases, AI/ML systems, and API development.
    
    Requirements:
    - 5+ years of Python development experience
    - Experience with FastAPI, Docker, and cloud platforms
    - Knowledge of machine learning and AI systems
    - Strong problem-solving skills
    """
    
    try:
        data = {"jd_text": test_jd}
        response = requests.post(f"{API_BASE}/jobs/upload-jd", data=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ JD Upload: PASSED")
            print(f"   Structured info: {result.get('structured_info', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ JD Upload: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ JD Upload: FAILED - {e}")
        return False

def test_cv_upload():
    """Test CV upload with text file"""
    test_cv_content = """
    John Doe
    Senior Python Developer
    Email: john.doe@example.com
    Phone: +1-555-0123
    
    Summary:
    Experienced Python developer with 6 years of experience in web development, 
    API design, and machine learning applications. Proficient in FastAPI, Django, 
    and various ML frameworks.
    
    Skills:
    - Python, FastAPI, Django
    - Machine Learning, TensorFlow, PyTorch
    - Docker, Kubernetes, AWS
    - PostgreSQL, MongoDB, Qdrant
    
    Education:
    - B.S. Computer Science, University of Technology (2018)
    
    Experience:
    - Senior Developer at Tech Corp (2021-Present)
    - Python Developer at StartupXYZ (2018-2021)
    """
    
    # Create a temporary text file
    with open("test_cv.txt", "w") as f:
        f.write(test_cv_content)
    
    try:
        # Convert to pseudo-docx by renaming (for testing purposes)
        os.rename("test_cv.txt", "test_cv.docx")
        
        with open("test_cv.docx", "rb") as f:
            files = {"files": ("test_cv.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
            response = requests.post(f"{API_BASE}/upload/", files=files, timeout=TIMEOUT)
        
        # Clean up
        os.remove("test_cv.docx")
        
        if response.status_code == 200:
            results = response.json()
            success_count = sum(1 for r in results if r.get("status") == "success")
            print(f"✅ CV Upload: PASSED - {success_count}/{len(results)} files processed successfully")
            return True
        else:
            print(f"❌ CV Upload: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ CV Upload: FAILED - {e}")
        # Clean up on error
        for filename in ["test_cv.txt", "test_cv.docx"]:
            if os.path.exists(filename):
                os.remove(filename)
        return False

def test_list_jds():
    """Test listing JDs"""
    try:
        response = requests.get(f"{API_BASE}/jobs/jds", timeout=TIMEOUT)
        
        if response.status_code == 200:
            jds = response.json()
            print(f"✅ List JDs: PASSED - Found {len(jds)} JDs")
            return jds
        else:
            print(f"❌ List JDs: FAILED - Status {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ List JDs: FAILED - {e}")
        return []

def test_matching(jds):
    """Test CV-JD matching"""
    if not jds:
        print("❌ Matching: SKIPPED - No JDs available")
        return False
    
    try:
        jd_id = jds[0]["id"]  # Use the first JD
        data = {"jd_id": jd_id, "top_k": 5}
        response = requests.post(f"{API_BASE}/jobs/match-candidates", json=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            matches = response.json()
            print(f"✅ Matching: PASSED - Found {len(matches)} candidate matches")
            for i, match in enumerate(matches[:3]):  # Show top 3
                score = match.get("score", 0) * 100
                name = match.get("payload", {}).get("full_name", "Unknown")
                print(f"   {i+1}. {name} - {score:.1f}% match")
            return True
        else:
            print(f"❌ Matching: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Matching: FAILED - {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing CV Analyzer Workflow")
    print("=" * 50)
    
    # Wait for services to be ready
    print("⏳ Waiting for services to start...")
    time.sleep(5)
    
    tests_passed = 0
    total_tests = 5
    
    # Run tests
    if test_health():
        tests_passed += 1
    
    if test_jd_upload():
        tests_passed += 1
    
    if test_cv_upload():
        tests_passed += 1
    
    jds = test_list_jds()
    if jds:
        tests_passed += 1
    
    if test_matching(jds):
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"📊 Test Summary: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! The CV analyzer workflow is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the logs above for details.")
        return 1

if __name__ == "__main__":
    exit(main()) 