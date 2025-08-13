"""
Debug Probe: End-to-end visibility for JD↔CV matching

What it shows (without changing your core logic):
- GPT standardization outputs for JD and two CVs (skills, responsibilities, title, years)
- Skill similarity decisions (who matched, who didn't) with thresholds
- Responsibility similarity overview
- Final weighted score, breakdown, and explanation for each CV vs the JD

Run inside Docker (recommended):
  cd /home/ubuntu/alpha-backend && docker-compose exec backend python3 debug_probe.py | cat

Note: Requires OPENAI_API_KEY available in the backend container.
"""

from __future__ import annotations

import json
import textwrap
from typing import Any, Dict, List

from app.utils.gpt_extractor import (
    standardize_job_description_with_gpt,
    standardize_cv_with_gpt,
)
from app.services.granular_matching_service import get_granular_matching_service
from app.services.embedding_service import get_embedding_service


JD_TEXT = textwrap.dedent(
    """
    Data Engineer Job description

    Design, develop, and maintain robust data pipelines using tools like Apache Spark, Kafka, Airflow, etc.

    Build and maintain data warehouses and data lakes (e.g., AWS Redshift, Snowflake, Google BigQuery, Azure Synapse).

    Integrate data from various sources such as APIs, databases, and external platforms.

    Ensure data quality, integrity, and consistency across systems.

    Work closely with data analysts, data scientists, and software engineers to support business and technical goals.

    Optimize query performance and implement best practices for data governance and security.

    Monitor and troubleshoot data pipeline issues, ensuring minimal downtime and data loss.

    Document data processes, architectures, and workflows.

    Required Qualifications:
    Bachelor’s degree in Computer Science, Engineering, Mathematics, or related field (Master’s preferred).

    2–5+ years of experience in a data engineering or similar role.

    Proficiency in programming languages such as Python, Java, or Scala.
    """
).strip()

CV1_TEXT = textwrap.dedent(
    """
    HEMAVATHI VUNNAM
    Data Engineer
    PROFESSIONAL EXPERIENCE
    Experienced Data Engineer a expertise in building data pipelines, developing data warehouses, and creating business intelligence solutions.
    Skilled in designing efficient ETL processes and leveraging BI tools to provide actionable insights. Adept at translating complex data into clear,
    strategic information to support business decision-making and improve performance
    TECHNICAL SKILLS
    Databases MYSQL, ORACLE, SQL SERVER, Azure SQL Database, Azure Cosmos DB,
    ETL and datawarehouse ADF, SSIS, Databricks, AWS Glue, Redshift
    Data Visualization POWER BI, AWS Quicksight, Google Looker
    Languages python, R
    EXPERIENCE
    EWINGS LLC ,Dubai
    Data Engineer
    Dubai
    09/2022 - 09/2024
    Designed and implemented end-to-end data pipelines using Azure Data Factory to integrate data and migrated tables from on premise SQL server
    Azure databricks is used to transform the raw data; azure synapse analytics to load the transformed data; Microsoft power BI for dashboards
    Monitor data pipelines, troubleshoot issues, CI/CD, code review, unit tests.
    Optimized data processing performance in ADF, improved latency
    Designed and developed interactive dashboards using Power BI and DAX
    Create custom visuals in Power BI using Python libraries
    Cognizant – Data Engineer (01/2021 - 08/2022)
    Created ADF pipelines for Parquet, Text, ORC, AVRO to Azure cloud
    Implemented Azure SQL Database, Azure Data Lake Storage, Azure Blob Storage
    Maintained SSAS Tabular; built reports in Power BI; DAX models
    Batch and real-time data processing using Azure Databricks, Azure Stream Analytics
    Strong SQL (queries, joins, procedures). Certifications: Azure DP-203, DP-900, AZ-900
    Skills: AZURE, ADF, SQL, POWER BI, DAX, AWS Quicksight, SQL SERVER, AWS REDSHIFT, Databricks, Azure Synapse Analytics, Azure Cosmos DB, Python, R
    """
).strip()

CV2_TEXT = textwrap.dedent(
    """
    SUMMARY
    Data Engineer with over 6+ years of experience in developing and managing scalable data pipelines and analytics solutions.
    PROFESSIONAL EXPERIENCE
    Data Engineer, Hexaware
    Data Engineer 2 (GCP/Azure), Fractal Analytics (Aug 2021–May 2024)
    - Deployed scalable data pipelines using Dataflow and Azure Data Factory (batch and streaming)
    - Transformed raw data into KPIs using SQL in BigQuery and PySpark in Databricks
    - Orchestrated pipelines with Apache Airflow Composer
    - Built visualizations with PowerBI
    - Designed solutions on Azure (Azure SQL Database, Azure Cosmos DB, Azure Data Lake Storage)
    System Engineer, IBM India (Aug 2018–Jul 2021)
    - End-to-end analysis on Azure and Databricks; automated metrics with Python
    TECHNICAL SKILLS
    Cloud: Azure, GCP, BigQuery, Airflow (Composer), Dataflow
    Data: Spark, Databricks, Batch and Streaming, Azure Synapse, Data Modeling, ETL/ELT, Real-Time Analytics, Data Lake/Warehouse
    Programming: Python/PySpark, SQL
    DevOps/Monitoring: Jenkins, Azure Monitor
    Visualization: PowerBI
    Certifications: AZ-900, Google Associate Cloud Engineer, Google Professional Data Engineer
    """
).strip()


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def summarize_list(name: str, items: List[str], max_items: int = 10) -> str:
    head = items[:max_items]
    more = len(items) - len(head)
    suffix = f" (+{more} more)" if more > 0 else ""
    return f"{name} ({len(items)}): {head}{suffix}"


def main() -> None:
    # 1) Standardize with GPT
    print_section("1) Standardizing JD and CVs with GPT-4o-mini")
    jd_std = standardize_job_description_with_gpt(JD_TEXT, "jd.txt")
    cv1_std = standardize_cv_with_gpt(CV1_TEXT, "cv1.txt")
    cv2_std = standardize_cv_with_gpt(CV2_TEXT, "cv2.txt")

    print(summarize_list("JD skills", jd_std.get("skills", [])))
    print(summarize_list("JD responsibilities", jd_std.get("responsibility_sentences", [])))
    print("JD title:", jd_std.get("job_title"), "| JD years:", jd_std.get("years_of_experience"))

    print(summarize_list("CV1 skills", cv1_std.get("skills", [])))
    print(summarize_list("CV1 responsibilities", cv1_std.get("responsibilities", [])))
    print("CV1 title:", cv1_std.get("job_title"), "| CV1 years:", cv1_std.get("years_of_experience"))

    print(summarize_list("CV2 skills", cv2_std.get("skills", [])))
    print(summarize_list("CV2 responsibilities", cv2_std.get("responsibilities", [])))
    print("CV2 title:", cv2_std.get("job_title"), "| CV2 years:", cv2_std.get("years_of_experience"))

    # 2) Skill similarity matrices
    print_section("2) Skill similarity decisions (JD → CV best matches)")
    emb = get_embedding_service()

    jd_skills = jd_std.get("skills", [])
    cv1_skills = cv1_std.get("skills", [])
    cv2_skills = cv2_std.get("skills", [])

    cv1_skill_analysis = emb.calculate_skill_similarity_matrix(jd_skills, cv1_skills)
    cv2_skill_analysis = emb.calculate_skill_similarity_matrix(jd_skills, cv2_skills)

    print("CV1 skill match %:", cv1_skill_analysis["skill_match_percentage"])  # threshold 0.70
    print("CV1 matched (top 5):", cv1_skill_analysis["matches"][:5])
    print("CV1 unmatched (first 10):", cv1_skill_analysis["unmatched_jd_skills"][:10])

    print("CV2 skill match %:", cv2_skill_analysis["skill_match_percentage"])  # threshold 0.70
    print("CV2 matched (top 5):", cv2_skill_analysis["matches"][:5])
    print("CV2 unmatched (first 10):", cv2_skill_analysis["unmatched_jd_skills"][:10])

    # 3) Responsibility similarity overview
    print_section("3) Responsibility similarity overview (JD → CV best matches)")
    jd_resps = jd_std.get("responsibility_sentences", [])
    cv1_resps = cv1_std.get("responsibilities", [])
    cv2_resps = cv2_std.get("responsibilities", [])

    cv1_resp_analysis = emb.calculate_responsibility_similarity_matrix(jd_resps, cv1_resps)
    cv2_resp_analysis = emb.calculate_responsibility_similarity_matrix(jd_resps, cv2_resps)

    print("CV1 responsibility match %:", cv1_resp_analysis["responsibility_match_percentage"])  # threshold 0.60
    print("CV1 responsibility matches (top 5):", cv1_resp_analysis["matches"][:5])

    print("CV2 responsibility match %:", cv2_resp_analysis["responsibility_match_percentage"])  # threshold 0.60
    print("CV2 responsibility matches (top 5):", cv2_resp_analysis["matches"][:5])

    # 4) Final weighted score per CV
    print_section("4) Final weighted score, breakdown, and explanation")
    matcher = get_granular_matching_service()

    cv1_result = matcher.perform_enhanced_matching(JD_TEXT, CV1_TEXT, jd_filename="jd.txt", cv_filename="cv1.txt")
    cv2_result = matcher.perform_enhanced_matching(JD_TEXT, CV2_TEXT, jd_filename="jd.txt", cv_filename="cv2.txt")

    def extract_summary(result: Dict[str, Any]) -> Dict[str, Any]:
        m = result["match_result"]
        detail = m["detailed_analysis"]
        return {
            "overall_score": m["overall_score"],
            "breakdown": m["breakdown"],
            "skill_match_pct": detail["skill_analysis"]["match_percentage"],
            "resp_match_pct": detail["responsibility_analysis"]["match_percentage"],
            "title_similarity": detail["title_analysis"]["similarity"],
            "years_meets": detail["experience_analysis"]["meets_requirement"],
            "explanation": m["explanation"],
            "missing_skills_first_10": detail["skill_analysis"]["unmatched"][:10],
        }

    print("CV1 summary:\n", json.dumps(extract_summary(cv1_result), indent=2))
    print("CV2 summary:\n", json.dumps(extract_summary(cv2_result), indent=2))


if __name__ == "__main__":
    main()


