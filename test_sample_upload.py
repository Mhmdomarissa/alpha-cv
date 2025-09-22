#!/usr/bin/env python3
"""
Test script to upload sample CV and JD to test category functionality.
"""

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

# Sample CV text
SAMPLE_CV_TEXT = """
John Smith
Senior Software Engineer
Email: john.smith@email.com
Phone: +1-555-0123

EXPERIENCE:
- 8 years of software development experience
- Python, JavaScript, React, Node.js, Django, Flask
- Database design and optimization (PostgreSQL, MongoDB)
- API development and microservices architecture
- Cloud platforms: AWS, Docker, Kubernetes
- Machine Learning: TensorFlow, PyTorch, scikit-learn

SKILLS:
- Programming Languages: Python, JavaScript, Java, C++, Go
- Web Frameworks: React, Node.js, Django, Flask, Express
- Databases: PostgreSQL, MongoDB, Redis, MySQL
- Cloud & DevOps: AWS, Docker, Kubernetes, Jenkins, GitLab CI
- Machine Learning: TensorFlow, PyTorch, scikit-learn, pandas, numpy

EDUCATION:
Master of Computer Science, Stanford University, 2016
Bachelor of Computer Science, UC Berkeley, 2014

PROJECTS:
- Built scalable microservices architecture serving 1M+ users
- Developed ML models for recommendation systems
- Led team of 5 engineers in agile development environment
"""

# Sample JD text
SAMPLE_JD_TEXT = """
Senior Software Engineer Position

We are looking for a Senior Software Engineer to join our innovative team.

REQUIREMENTS:
- 7+ years of software development experience
- Strong proficiency in Python and JavaScript
- Experience with React, Node.js, and modern web frameworks
- Database design and optimization skills
- API development and microservices experience
- Cloud platform experience (AWS preferred)
- Machine Learning experience is a plus

RESPONSIBILITIES:
- Develop and maintain scalable web applications
- Design and implement RESTful APIs
- Optimize database performance and queries
- Collaborate with cross-functional teams
- Mentor junior developers
- Lead technical architecture decisions
- Implement CI/CD pipelines

TECHNICAL STACK:
- Backend: Python, Node.js, Django, Flask
- Frontend: React, JavaScript, HTML5, CSS3
- Databases: PostgreSQL, MongoDB, Redis
- Cloud: AWS, Docker, Kubernetes
- Tools: Git, Jenkins, JIRA, Confluence
"""

def test_upload_cv():
    """Test CV upload with category extraction."""
    print("📤 Testing CV Upload...")
    
    data = {
        'cv_text': SAMPLE_CV_TEXT
    }
    
    try:
        response = requests.post(f"{API_BASE}/cv/upload-cv", data=data, timeout=60)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Success: CV uploaded with ID: {result.get('cv_id', 'N/A')}")
            return result.get('cv_id')
        else:
            print(f"   ❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return None

def test_upload_jd():
    """Test JD upload with category extraction."""
    print("📄 Testing JD Upload...")
    
    data = {
        'jd_text': SAMPLE_JD_TEXT
    }
    
    try:
        response = requests.post(f"{API_BASE}/jd/upload-jd", data=data, timeout=60)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Success: JD uploaded with ID: {result.get('jd_id', 'N/A')}")
            return result.get('jd_id')
        else:
            print(f"   ❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return None

def test_get_categories():
    """Test getting categories after upload."""
    print("📊 Testing Get Categories...")
    
    try:
        response = requests.get(f"{API_BASE}/cv/categories", timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            categories = result.get("categories", {})
            print(f"   ✅ Success: Found {len(categories)} categories:")
            for category, count in categories.items():
                print(f"      • {category}: {count} CVs")
            return categories
        else:
            print(f"   ❌ Error: {response.text}")
            return {}
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return {}

def test_get_cvs_by_category(category):
    """Test getting CVs by category."""
    print(f"📁 Testing Get CVs by Category: {category}...")
    
    try:
        response = requests.get(f"{API_BASE}/cv/cvs/category/{category}", timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            cvs = result.get("cvs", [])
            print(f"   ✅ Success: Found {len(cvs)} CVs in {category}")
            return cvs
        else:
            print(f"   ❌ Error: {response.text}")
            return []
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return []

def test_category_based_matching(jd_id):
    """Test category-based matching."""
    print(f"🎯 Testing Category-Based Matching for JD: {jd_id}...")
    
    data = {
        "jd_id": jd_id,
        "limit": 5
    }
    
    try:
        response = requests.post(f"{API_BASE}/match/category-based", json=data, timeout=60)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            matches = result.get("data", {}).get("matches", [])
            print(f"   ✅ Success: Found {len(matches)} matches")
            return matches
        else:
            print(f"   ❌ Error: {response.text}")
            return []
            
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return []

def main():
    """Run comprehensive tests."""
    print("🚀 Testing System with Sample Data")
    print("=" * 50)
    
    # Test 1: Upload CV
    cv_id = test_upload_cv()
    if not cv_id:
        print("❌ CV upload failed, stopping tests")
        return
    
    # Wait for processing
    print("⏳ Waiting for CV processing...")
    time.sleep(10)
    
    # Test 2: Upload JD
    jd_id = test_upload_jd()
    if not jd_id:
        print("❌ JD upload failed, stopping tests")
        return
    
    # Wait for processing
    print("⏳ Waiting for JD processing...")
    time.sleep(10)
    
    # Test 3: Get categories
    categories = test_get_categories()
    if not categories:
        print("❌ No categories found")
        return
    
    # Test 4: Get CVs by category
    for category in categories.keys():
        test_get_cvs_by_category(category)
    
    # Test 5: Category-based matching
    if jd_id:
        test_category_based_matching(jd_id)
    
    print("\n" + "=" * 50)
    print("✅ Sample Data Tests Completed!")
    print(f"📊 Summary:")
    print(f"   • CV uploaded: {cv_id}")
    print(f"   • JD uploaded: {jd_id}")
    print(f"   • Categories found: {len(categories)}")
    for category, count in categories.items():
        print(f"     - {category}: {count} CVs")

if __name__ == "__main__":
    main()
