#!/usr/bin/env python3
"""
Test script to verify CV upload flows work the same way:
1. Regular CV upload (optimized)
2. Job application CV upload (should use same optimizations)
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def test_regular_cv_upload():
    """Test regular CV upload with optimizations"""
    print("🔍 Testing regular CV upload (optimized)...")
    
    cv_text = """John Doe
Software Engineer
5 years experience
Skills: Python, JavaScript, React, Node.js, AWS
Responsibilities: Develop web applications, Write clean code, Lead team projects
Email: john.doe@example.com
Phone: +971501234567"""
    
    try:
        response = requests.post(f"{BASE_URL}/api/cv/upload-cv", 
            data={
                "cv_text": cv_text,
                "background_processing": "true"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            cv_id = data.get("cv_id")
            print(f"✅ Regular CV upload successful: {cv_id}")
            print(f"   Processing mode: {data.get('processing_mode')}")
            print(f"   Estimated completion: {data.get('estimated_completion')}")
            return cv_id
        else:
            print(f"❌ Regular CV upload failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Regular CV upload error: {e}")
        return None

def test_job_application_cv_upload():
    """Test job application CV upload"""
    print("\n🔍 Testing job application CV upload...")
    
    # First, we need a valid job posting token
    # For now, let's test with a mock token and see what happens
    mock_token = "test_job_token_123"
    
    cv_text = """Jane Smith
Frontend Developer
4 years experience
Skills: React, Vue.js, TypeScript, CSS, HTML
Responsibilities: Build user interfaces, Optimize performance, Collaborate with designers
Email: jane.smith@example.com
Phone: +971501234568"""
    
    try:
        # Create a temporary file for the CV
        with open("temp_cv.txt", "w") as f:
            f.write(cv_text)
        
        with open("temp_cv.txt", "rb") as f:
            files = {"cv_file": ("test_cv.txt", f, "text/plain")}
            data = {
                "applicant_name": "Jane Smith",
                "applicant_email": "jane.smith@example.com",
                "applicant_phone": "+971501234568",
                "cover_letter": "I am very interested in this position.",
                "background_processing": "true"
            }
            
            response = requests.post(f"{BASE_URL}/api/careers/jobs/{mock_token}/apply", 
                files=files,
                data=data,
                timeout=30
            )
        
        # Clean up temp file
        import os
        try:
            os.remove("temp_cv.txt")
        except:
            pass
        
        if response.status_code == 200:
            data = response.json()
            application_id = data.get("application_id")
            print(f"✅ Job application CV upload successful: {application_id}")
            print(f"   Message: {data.get('message')}")
            print(f"   Next steps: {data.get('next_steps')}")
            return application_id
        else:
            print(f"❌ Job application CV upload failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Job application CV upload error: {e}")
        return None

def check_cv_in_database(cv_id, cv_type="regular"):
    """Check if CV is properly stored in database"""
    print(f"\n🔍 Checking {cv_type} CV in database...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/cv/{cv_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            cv_data = data.get("cv", {})
            
            print(f"✅ CV found in database:")
            print(f"   ID: {cv_data.get('id')}")
            print(f"   Filename: {cv_data.get('filename')}")
            print(f"   Upload date: {cv_data.get('upload_date')}")
            print(f"   Is job application: {cv_data.get('is_job_application')}")
            
            candidate = cv_data.get("candidate", {})
            print(f"   Candidate name: {candidate.get('full_name')}")
            print(f"   Job title: {candidate.get('job_title')}")
            print(f"   Skills count: {candidate.get('skills_count')}")
            print(f"   Responsibilities count: {candidate.get('responsibilities_count')}")
            
            # Check embeddings
            embeddings = cv_data.get("embeddings_info", {})
            print(f"   Skills embeddings: {embeddings.get('skills_embeddings')}")
            print(f"   Responsibilities embeddings: {embeddings.get('responsibilities_embeddings')}")
            print(f"   Has title embedding: {embeddings.get('has_title_embedding')}")
            print(f"   Has experience embedding: {embeddings.get('has_experience_embedding')}")
            
            return True
        else:
            print(f"❌ CV not found in database: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking CV in database: {e}")
        return False

def check_processing_progress(cv_id):
    """Check processing progress"""
    print(f"\n🔍 Checking processing progress for {cv_id}...")
    
    try:
        response = requests.get(f"{BASE_URL}/api/cv/cv-upload-progress/{cv_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Progress status: {data.get('status')}")
            print(f"   Progress: {data.get('progress_percent')}%")
            print(f"   Current step: {data.get('current_step')}")
            
            if data.get('status') == 'completed':
                stats = data.get('processing_stats', {})
                print(f"   Processing stats:")
                print(f"     Text length: {stats.get('text_length')}")
                print(f"     Skills count: {stats.get('skills_count')}")
                print(f"     Responsibilities count: {stats.get('responsibilities_count')}")
                print(f"     Embeddings generated: {stats.get('embeddings_generated')}")
            
            return data.get('status') == 'completed'
        else:
            print(f"❌ Progress check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error checking progress: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing CV Upload Flows")
    print("=" * 50)
    
    # Test 1: Regular CV upload
    print("\n📋 TEST 1: Regular CV Upload (Optimized)")
    print("-" * 40)
    regular_cv_id = test_regular_cv_upload()
    
    if regular_cv_id:
        # Wait a bit for processing
        print("\n⏳ Waiting for processing...")
        time.sleep(5)
        
        # Check progress
        check_processing_progress(regular_cv_id)
        
        # Check in database
        check_cv_in_database(regular_cv_id, "regular")
    
    # Test 2: Job application CV upload
    print("\n📋 TEST 2: Job Application CV Upload")
    print("-" * 40)
    job_cv_id = test_job_application_cv_upload()
    
    if job_cv_id:
        # Wait a bit for processing
        print("\n⏳ Waiting for processing...")
        time.sleep(5)
        
        # Check progress
        check_processing_progress(job_cv_id)
        
        # Check in database
        check_cv_in_database(job_cv_id, "job application")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    if regular_cv_id:
        print("✅ Regular CV upload: WORKING")
    else:
        print("❌ Regular CV upload: FAILED")
    
    if job_cv_id:
        print("✅ Job application CV upload: WORKING")
    else:
        print("❌ Job application CV upload: FAILED")
    
    print("\n🎯 Both upload methods should use the same optimized processing!")
    
    return regular_cv_id is not None and job_cv_id is not None

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
