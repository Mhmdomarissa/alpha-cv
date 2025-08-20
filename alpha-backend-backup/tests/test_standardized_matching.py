#!/usr/bin/env python3
"""
Comprehensive test script for standardized CV and JD matching functionality.
Tests all standardized endpoints with real data.
"""
import requests
import json
import time
import os
from typing import Dict, Any, List

# Configuration
API_BASE = "http://localhost:8000"
TIMEOUT = 60

def test_health_endpoints():
    """Test all health check endpoints."""
    print("\n🏥 Testing Health Endpoints...")
    
    endpoints = [
        "/health",
        "/api/upload/health", 
        "/api/jobs/health"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{API_BASE}{endpoint}", timeout=TIMEOUT)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {endpoint}: {result.get('status', 'unknown')}")
            else:
                print(f"❌ {endpoint}: Status {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: {e}")

def test_system_status():
    """Test system status endpoint."""
    print("\n📊 Testing System Status...")
    
    try:
        response = requests.get(f"{API_BASE}/api/upload/system-status", timeout=TIMEOUT)
        if response.status_code == 200:
            result = response.json()
            print("✅ System Status: PASSED")
            print(f"   Total CVs: {result.get('system_stats', {}).get('total_cvs', 0)}")
            print(f"   Total JDs: {result.get('system_stats', {}).get('total_jds', 0)}")
            print(f"   API Status: {result.get('system_stats', {}).get('api_status', 'unknown')}")
            print(f"   Mock Mode: {result.get('system_stats', {}).get('mock_mode', False)}")
            return result
        else:
            print(f"❌ System Status: FAILED - Status {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ System Status: FAILED - {e}")
        return None

def test_standardized_jd_processing():
    """Test standardized job description processing with real JD data."""
    print("\n🧪 Testing Standardized JD Processing...")
    
    # Real JD data
    test_jd = """
    Senior Software Engineer - Cloud Infrastructure
    
    We are seeking a highly skilled Senior Software Engineer with expertise in cloud infrastructure and DevOps practices. The ideal candidate will have experience with AWS, Azure, Kubernetes, Docker, and CI/CD pipelines.
    
    Requirements:
    - 5+ years of experience in software development
    - Strong knowledge of cloud platforms (AWS, Azure, GCP)
    - Experience with containerization technologies (Docker, Kubernetes)
    - Proficiency in Infrastructure as Code (Terraform, CloudFormation)
    - Knowledge of CI/CD tools (Jenkins, GitLab CI, GitHub Actions)
    - Programming skills in Python, Java, or Go
    - Experience with monitoring and logging tools
    
    Skills Required:
    - Cloud Infrastructure Management
    - DevOps and Automation
    - Microservices Architecture
    - Database Management (SQL, NoSQL)
    - Security Best Practices
    - Agile Development Methodologies
    
    Location: Remote/Hybrid
    Employment Type: Full-time
    Experience Required: 5+ years
    Company: TechCorp Solutions
    """
    
    try:
        data = {"jd_text": test_jd}
        response = requests.post(f"{API_BASE}/api/jobs/standardize-jd", data=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Standardized JD Processing: PASSED")
            print(f"   JD ID: {result.get('jd_id')}")
            print(f"   Skills: {result.get('standardized_data', {}).get('skills', [])[:5]}...")
            print(f"   Job Title: {result.get('standardized_data', {}).get('job_title', 'N/A')}")
            print(f"   Years Required: {result.get('standardized_data', {}).get('years_of_experience', 'N/A')}")
            return result.get('jd_id')
        else:
            print(f"❌ Standardized JD Processing: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Standardized JD Processing: FAILED - {e}")
        return None

def test_standardized_cv_processing():
    """Test standardized CV processing with real CV data."""
    print("\n🧪 Testing Standardized CV Processing...")
    
    # Real CV data
    test_cv_content = """
    JOHN DAVID SMITH
    Senior Software Engineer
    
    Contact Information:
    Email: john.smith@email.com
    Phone: +1-555-123-4567
    Location: New York, NY
    
    PROFESSIONAL SUMMARY
    Experienced Senior Software Engineer with 8 years of experience in full-stack development. 
    Specialized in cloud technologies, microservices architecture, and DevOps practices.
    
    TECHNICAL SKILLS
    • Programming Languages: Python, JavaScript, Java, Go
    • Frameworks: React, Node.js, Django, Spring Boot
    • Cloud Platforms: AWS, Azure, Docker, Kubernetes
    • Databases: PostgreSQL, MongoDB, Redis
    • DevOps: CI/CD, Jenkins, Terraform, Git
    
    WORK EXPERIENCE
    
    Senior Software Engineer | TechCorp Inc. | 2020-Present
    • Led development of microservices architecture serving 1M+ users
    • Implemented CI/CD pipelines reducing deployment time by 60%
    • Mentored junior developers and conducted code reviews
    • Technologies: Python, AWS, Docker, Kubernetes
    
    Software Engineer | StartupXYZ | 2018-2020
    • Developed React-based frontend applications
    • Built RESTful APIs using Node.js and Express
    • Collaborated with cross-functional teams in Agile environment
    • Technologies: JavaScript, React, Node.js, MongoDB
    
    Junior Developer | CodeCorp | 2016-2018
    • Developed web applications using Java and Spring Boot
    • Participated in requirements gathering and system design
    • Fixed bugs and implemented new features
    • Technologies: Java, Spring Boot, MySQL
    
    EDUCATION
    Bachelor of Science in Computer Science
    University of Technology | 2016
    GPA: 3.8/4.0
    
    CERTIFICATIONS
    • AWS Certified Solutions Architect - Professional
    • Certified Kubernetes Administrator (CKA)
    • Scrum Master Certification
    
    PROJECTS
    • E-commerce Platform: Built scalable microservices architecture
    • Real-time Chat Application: Implemented using WebSocket and Redis
    • DevOps Automation: Created infrastructure as code using Terraform
    """
    
    try:
        # Use text input instead of file upload for testing
        data = {"cv_text": test_cv_content}
        response = requests.post(f"{API_BASE}/api/jobs/standardize-cv-text", data=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Standardized CV Processing: PASSED")
            print(f"   CV ID: {result.get('cv_id')}")
            print(f"   Skills: {result.get('standardized_data', {}).get('skills', [])[:5]}...")
            print(f"   Job Title: {result.get('standardized_data', {}).get('job_title', 'N/A')}")
            print(f"   Years Experience: {result.get('standardized_data', {}).get('years_of_experience', 'N/A')}")
            return result.get('cv_id')
        else:
            print(f"❌ Standardized CV Processing: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Standardized CV Processing: FAILED - {e}")
        return None

def test_standardized_match_calculation(jd_id: str, cv_id: str):
    """Test standardized match calculation between JD and CV."""
    print("\n🔍 Testing Standardized Match Calculation...")
    
    try:
        data = {"jd_id": jd_id, "cv_id": cv_id}
        response = requests.post(f"{API_BASE}/api/jobs/calculate-standardized-match", json=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            match_result = result.get('match_result', {})
            
            print("✅ Standardized Match Calculation: PASSED")
            print(f"   Overall Score: {match_result.get('overall_score', 0)}%")
            print(f"   Skills Score: {match_result.get('breakdown', {}).get('skills_score', 0)}%")
            print(f"   Experience Score: {match_result.get('breakdown', {}).get('experience_score', 0)}%")
            print(f"   Title Score: {match_result.get('breakdown', {}).get('title_score', 0)}%")
            print(f"   Text Similarity: {match_result.get('breakdown', {}).get('text_similarity_score', 0)}%")
            print(f"   Explanation: {match_result.get('explanation', 'N/A')}")
            
            return match_result.get('overall_score', 0)
        else:
            print(f"❌ Standardized Match Calculation: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Standardized Match Calculation: FAILED - {e}")
        return None

def test_standardize_and_match():
    """Test the combined standardize-and-match endpoint."""
    print("\n🚀 Testing Standardize-and-Match Endpoint...")
    
    # Test data
    jd_text = """
    Python Developer - Backend Focus
    
    We are looking for a Python developer with strong backend development skills.
    The ideal candidate should have 3+ years of experience with Python, Django, and PostgreSQL.
    
    Required Skills:
    - Python (Django/FastAPI)
    - PostgreSQL
    - REST APIs
    - Git
    - Docker
    
    Responsibilities:
    - Develop and maintain backend services
    - Design and implement REST APIs
    - Optimize database queries
    - Write unit tests
    - Deploy applications to cloud platforms
    """
    
    cv_text = """
    Sarah Johnson
    Python Backend Developer
    
    Email: sarah.johnson@email.com
    Phone: +1-555-987-6543
    
    Summary:
    Experienced Python developer with 4 years of backend development experience.
    Proficient in Django, FastAPI, PostgreSQL, and cloud deployment.
    
    Skills:
    - Python (Django, FastAPI)
    - PostgreSQL, MySQL
    - REST APIs
    - Docker, AWS
    - Git, CI/CD
    
    Experience:
    - Backend Developer at WebCorp (2021-Present)
      * Developed REST APIs using Django and FastAPI
      * Optimized database performance by 40%
      * Implemented automated testing
    
    - Junior Developer at TechStart (2019-2021)
      * Built web applications with Django
      * Worked with PostgreSQL databases
      * Participated in code reviews
    
    Education:
    - B.S. Computer Science, Tech University (2019)
    """
    
    try:
        data = {"jd_text": jd_text, "cv_text": cv_text}
        response = requests.post(f"{API_BASE}/api/jobs/standardize-and-match-text", json=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            match_result = result.get('match_result', {})
            
            print("✅ Standardize-and-Match: PASSED")
            print(f"   JD ID: {result.get('jd_id')}")
            print(f"   CV ID: {result.get('cv_id')}")
            print(f"   Overall Score: {match_result.get('overall_score', 0)}%")
            print(f"   Skills Score: {match_result.get('breakdown', {}).get('skills_score', 0)}%")
            print(f"   Experience Score: {match_result.get('breakdown', {}).get('experience_score', 0)}%")
            
            return result
        else:
            print(f"❌ Standardize-and-Match: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Standardize-and-Match: FAILED - {e}")
        return None

def test_batch_standardized_match(jd_id: str, cv_ids: List[str]):
    """Test batch standardized matching."""
    print("\n📊 Testing Batch Standardized Matching...")
    
    try:
        data = {
            "jd_id": jd_id,
            "cv_ids": cv_ids,
            "top_k": 3
        }
        response = requests.post(f"{API_BASE}/api/jobs/batch-standardized-match", json=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            top_matches = result.get('top_matches', [])
            
            print("✅ Batch Standardized Matching: PASSED")
            print(f"   Total Candidates: {result.get('total_candidates', 0)}")
            print(f"   Top Matches: {len(top_matches)}")
            
            for i, match in enumerate(top_matches[:3], 1):
                score = match.get('match_result', {}).get('overall_score', 0)
                filename = match.get('filename', 'Unknown')
                print(f"   {i}. {filename}: {score}%")
            
            return result
        else:
            print(f"❌ Batch Standardized Matching: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Batch Standardized Matching: FAILED - {e}")
        return None

def test_list_endpoints():
    """Test list endpoints for CVs and JDs."""
    print("\n📋 Testing List Endpoints...")
    
    # Test list JDs
    try:
        response = requests.get(f"{API_BASE}/api/jobs/list-jds", timeout=TIMEOUT)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ List JDs: PASSED - {result.get('count', 0)} JDs found")
        else:
            print(f"❌ List JDs: FAILED - Status {response.status_code}")
    except Exception as e:
        print(f"❌ List JDs: FAILED - {e}")
    
    # Test list CVs
    try:
        response = requests.get(f"{API_BASE}/api/jobs/list-cvs", timeout=TIMEOUT)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ List CVs: PASSED - {result.get('count', 0)} CVs found")
        else:
            print(f"❌ List CVs: FAILED - Status {response.status_code}")
    except Exception as e:
        print(f"❌ List CVs: FAILED - {e}")

def test_database_viewer():
    """Test database viewer endpoint."""
    print("\n🗄️ Testing Database Viewer...")
    
    try:
        response = requests.get(f"{API_BASE}/api/upload/debug/database-viewer", timeout=TIMEOUT)
        if response.status_code == 200:
            result = response.json()
            cvs_count = result.get('collections', {}).get('cvs', {}).get('count', 0)
            jds_count = result.get('collections', {}).get('jds', {}).get('count', 0)
            
            print("✅ Database Viewer: PASSED")
            print(f"   CVs in Database: {cvs_count}")
            print(f"   JDs in Database: {jds_count}")
            return result
        else:
            print(f"❌ Database Viewer: FAILED - Status {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Database Viewer: FAILED - {e}")
        return None

def run_comprehensive_test():
    """Run comprehensive test of all standardized functionality."""
    print("🚀 Starting Comprehensive Standardized Matching Test")
    print("=" * 60)
    
    # Test 1: Health checks
    test_health_endpoints()
    
    # Test 2: System status
    system_status = test_system_status()
    
    # Test 3: Database viewer
    db_viewer = test_database_viewer()
    
    # Test 4: List endpoints
    test_list_endpoints()
    
    # Test 5: Standardized JD processing
    jd_id = test_standardized_jd_processing()
    
    # Test 6: Standardized CV processing
    cv_id = test_standardized_cv_processing()
    
    # Test 7: Standardized match calculation
    if jd_id and cv_id:
        match_score = test_standardized_match_calculation(jd_id, cv_id)
    else:
        print("\n⚠️ Skipping match calculation - missing JD or CV ID")
        match_score = None
    
    # Test 8: Standardize and match
    standardize_match_result = test_standardize_and_match()
    
    # Test 9: Batch matching (if we have multiple CVs)
    if jd_id and cv_id:
        test_batch_standardized_match(jd_id, [cv_id])
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    if jd_id:
        print(f"✅ JD Processing: SUCCESS (ID: {jd_id})")
    else:
        print("❌ JD Processing: FAILED")
    
    if cv_id:
        print(f"✅ CV Processing: SUCCESS (ID: {cv_id})")
    else:
        print("❌ CV Processing: FAILED")
    
    if match_score is not None:
        print(f"✅ Match Calculation: SUCCESS (Score: {match_score}%)")
    else:
        print("❌ Match Calculation: FAILED")
    
    if standardize_match_result:
        print("✅ Standardize-and-Match: SUCCESS")
    else:
        print("❌ Standardize-and-Match: FAILED")
    
    print("\n🎉 Comprehensive test completed!")

if __name__ == "__main__":
    run_comprehensive_test() 