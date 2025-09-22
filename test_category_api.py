#!/usr/bin/env python3
"""
Test script to verify category API endpoints work correctly.
This script tests the new category-based functionality.
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

def test_api_endpoint(method: str, endpoint: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Test an API endpoint and return the response."""
    url = f"{API_BASE}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"🔍 {method.upper()} {endpoint}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Success: {json.dumps(result, indent=2)[:200]}...")
            return result
        else:
            print(f"   ❌ Error: {response.text}")
            return {"error": response.text, "status_code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Request failed: {e}")
        return {"error": str(e)}

def test_health_check():
    """Test the health check endpoint."""
    print("\n🏥 Testing Health Check...")
    result = test_api_endpoint("GET", "/health")
    return result

def test_get_categories():
    """Test getting categories."""
    print("\n📊 Testing Get Categories...")
    result = test_api_endpoint("GET", "/cv/categories")
    return result

def test_get_cvs_by_category(category: str):
    """Test getting CVs by category."""
    print(f"\n📁 Testing Get CVs by Category: {category}...")
    result = test_api_endpoint("GET", f"/cv/cvs/category/{category}")
    return result

def test_list_all_cvs():
    """Test listing all CVs."""
    print("\n📋 Testing List All CVs...")
    result = test_api_endpoint("GET", "/cv/cvs")
    return result

def test_list_all_jds():
    """Test listing all JDs."""
    print("\n📄 Testing List All JDs...")
    result = test_api_endpoint("GET", "/jd/jds")
    return result

def test_category_based_matching(jd_id: str):
    """Test category-based matching."""
    print(f"\n🎯 Testing Category-Based Matching for JD: {jd_id}...")
    data = {"jd_id": jd_id, "top_k": 5}
    result = test_api_endpoint("POST", "/match/category-based", data)
    return result

def main():
    """Run all tests."""
    print("🚀 Starting Category API Tests...")
    print("=" * 50)
    
    # Test 1: Health Check
    health_result = test_health_check()
    if "error" in health_result:
        print("❌ Health check failed. Is the server running?")
        sys.exit(1)
    
    # Test 2: Get Categories
    categories_result = test_get_categories()
    if "error" in categories_result:
        print("❌ Failed to get categories")
        return
    
    categories = categories_result.get("categories", {})
    print(f"\n📊 Found {len(categories)} categories:")
    for category, count in categories.items():
        print(f"   • {category}: {count} CVs")
    
    # Test 3: List All CVs
    cvs_result = test_list_all_cvs()
    if "error" in cvs_result:
        print("❌ Failed to list CVs")
        return
    
    cvs = cvs_result.get("cvs", [])
    print(f"\n📋 Found {len(cvs)} total CVs")
    
    # Test 4: List All JDs
    jds_result = test_list_all_jds()
    if "error" in jds_result:
        print("❌ Failed to list JDs")
        return
    
    jds = jds_result.get("jds", [])
    print(f"\n📄 Found {len(jds)} total JDs")
    
    # Test 5: Test each category
    if categories:
        print(f"\n📁 Testing individual categories...")
        for category in categories.keys():
            category_cvs = test_get_cvs_by_category(category)
            if "error" not in category_cvs:
                cv_count = len(category_cvs.get("cvs", []))
                print(f"   ✅ {category}: {cv_count} CVs")
            else:
                print(f"   ❌ {category}: Failed to load")
    
    # Test 6: Category-based matching (if we have JDs)
    if jds:
        print(f"\n🎯 Testing category-based matching...")
        first_jd = jds[0]
        jd_id = first_jd.get("id")
        if jd_id:
            match_result = test_category_based_matching(jd_id)
            if "error" not in match_result:
                matches = match_result.get("data", {}).get("matches", [])
                print(f"   ✅ Found {len(matches)} matches for JD {jd_id}")
            else:
                print(f"   ❌ Category-based matching failed")
    
    print("\n" + "=" * 50)
    print("✅ Category API Tests Completed!")
    
    # Summary
    print(f"\n📊 Summary:")
    print(f"   • Categories: {len(categories)}")
    print(f"   • Total CVs: {len(cvs)}")
    print(f"   • Total JDs: {len(jds)}")
    
    if categories:
        print(f"   • Category breakdown:")
        for category, count in categories.items():
            print(f"     - {category}: {count} CVs")

if __name__ == "__main__":
    main()
