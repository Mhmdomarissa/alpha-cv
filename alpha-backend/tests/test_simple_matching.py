#!/usr/bin/env python3
"""
Simple test script to verify standardized matching with existing database data.
"""
import requests
import json
import time

# Configuration
API_BASE = "http://localhost:8000"
TIMEOUT = 60

def test_with_existing_data():
    """Test matching with existing data in the database."""
    print("🧪 Testing with existing database data...")
    
    # First, get existing JDs and CVs
    try:
        # Get JDs
        jd_response = requests.get(f"{API_BASE}/api/jobs/list-jds", timeout=TIMEOUT)
        if jd_response.status_code == 200:
            jds = jd_response.json().get('jds', [])
            print(f"Found {len(jds)} JDs in database")
            
            if jds:
                # Use the first JD
                jd_id = jds[0].get('id')
                print(f"Using JD ID: {jd_id}")
                
                # Get CVs
                cv_response = requests.get(f"{API_BASE}/api/jobs/list-cvs", timeout=TIMEOUT)
                if cv_response.status_code == 200:
                    cvs = cv_response.json().get('cvs', [])
                    print(f"Found {len(cvs)} CVs in database")
                    
                    if cvs:
                        # Use the first CV
                        cv_id = cvs[0].get('id')
                        print(f"Using CV ID: {cv_id}")
                        
                        # Test match calculation
                        match_data = {"jd_id": jd_id, "cv_id": cv_id}
                        match_response = requests.post(
                            f"{API_BASE}/api/jobs/calculate-standardized-match", 
                            json=match_data, 
                            timeout=TIMEOUT
                        )
                        
                        if match_response.status_code == 200:
                            result = match_response.json()
                            match_result = result.get('match_result', {})
                            
                            print("✅ Match calculation successful!")
                            print(f"   Overall Score: {match_result.get('overall_score', 0)}%")
                            print(f"   Skills Score: {match_result.get('breakdown', {}).get('skills_score', 0)}%")
                            print(f"   Experience Score: {match_result.get('breakdown', {}).get('experience_score', 0)}%")
                            print(f"   Title Score: {match_result.get('breakdown', {}).get('title_score', 0)}%")
                            print(f"   Text Similarity: {match_result.get('breakdown', {}).get('text_similarity_score', 0)}%")
                            print(f"   Explanation: {match_result.get('explanation', 'N/A')}")
                            
                            return True
                        else:
                            print(f"❌ Match calculation failed: {match_response.status_code}")
                            print(f"   Response: {match_response.text}")
                            return False
                    else:
                        print("❌ No CVs found in database")
                        return False
                else:
                    print(f"❌ Failed to get CVs: {cv_response.status_code}")
                    return False
            else:
                print("❌ No JDs found in database")
                return False
        else:
            print(f"❌ Failed to get JDs: {jd_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing with existing data: {e}")
        return False

def test_standardize_and_match():
    """Test the standardize-and-match endpoint with simple data."""
    print("\n🚀 Testing Standardize-and-Match with simple data...")
    
    jd_text = """
    Python Developer
    
    We are looking for a Python developer with 3+ years of experience.
    Required skills: Python, Django, PostgreSQL, Git
    """
    
    cv_text = """
    John Doe
    Python Developer
    
    Experience: 4 years of Python development
    Skills: Python, Django, PostgreSQL, Git, React
    """
    
    try:
        data = {"jd_text": jd_text, "cv_text": cv_text}
        response = requests.post(f"{API_BASE}/api/jobs/standardize-and-match-text", json=data, timeout=TIMEOUT)
        
        if response.status_code == 200:
            result = response.json()
            match_result = result.get('match_result', {})
            
            print("✅ Standardize-and-Match: SUCCESS")
            print(f"   JD ID: {result.get('jd_id')}")
            print(f"   CV ID: {result.get('cv_id')}")
            print(f"   Overall Score: {match_result.get('overall_score', 0)}%")
            print(f"   Skills Score: {match_result.get('breakdown', {}).get('skills_score', 0)}%")
            print(f"   Experience Score: {match_result.get('breakdown', {}).get('experience_score', 0)}%")
            
            return True
        else:
            print(f"❌ Standardize-and-Match: FAILED - Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Standardize-and-Match: FAILED - {e}")
        return False

def main():
    """Run the simple tests."""
    print("🚀 Starting Simple Matching Tests")
    print("=" * 50)
    
    # Test 1: Match with existing data
    test1_success = test_with_existing_data()
    
    # Test 2: Standardize and match
    test2_success = test_standardize_and_match()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    if test1_success:
        print("✅ Existing Data Matching: SUCCESS")
    else:
        print("❌ Existing Data Matching: FAILED")
    
    if test2_success:
        print("✅ Standardize-and-Match: SUCCESS")
    else:
        print("❌ Standardize-and-Match: FAILED")
    
    print("\n🎉 Simple tests completed!")

if __name__ == "__main__":
    main() 