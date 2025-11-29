#!/usr/bin/env python3
"""
Generate a CSV file with test contacts for testing the lead import system.
Usage: python3 generate_test_contacts.py [num_contacts]
Example: python3 generate_test_contacts.py 100
"""

import csv
import random
import string
import sys
from faker import Faker

# Initialize Faker
fake = Faker()

# Default configuration
DEFAULT_NUM_CONTACTS = 100

# Job titles pool
JOB_TITLES = [
    'Software Engineer', 'Product Manager', 'Data Scientist', 'DevOps Engineer',
    'UX Designer', 'Marketing Manager', 'Sales Director', 'CTO', 'CEO',
    'VP of Engineering', 'Business Analyst', 'Project Manager', 'QA Engineer',
    'Customer Success Manager', 'Account Executive', 'HR Manager', 'CFO',
    'Operations Manager', 'Content Writer', 'Social Media Manager'
]

# Country codes pool
COUNTRY_CODES = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE']

def generate_random_suffix(length=5):
    """Generate a random string of lowercase letters."""
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def generate_contacts(num_contacts):
    """Generate a list of contact dictionaries."""
    contacts = []
    
    for i in range(num_contacts):
        # Generate basic info
        first_name = fake.first_name()
        last_name = fake.last_name()
        
        # Generate email with some variety
        email_formats = [
            f"{first_name.lower()}.{last_name.lower()}@{fake.domain_name()}",
            f"{first_name.lower()}{random.randint(1, 99)}@{fake.free_email_domain()}",
            f"{last_name.lower()}{first_name[0].lower()}@{fake.domain_name()}",
        ]
        email = random.choice(email_formats)
        
        # Randomly include optional fields (80% chance)
        job_title = random.choice(JOB_TITLES) if random.random() > 0.2 else ''
        country_code = random.choice(COUNTRY_CODES) if random.random() > 0.2 else ''
        company_name = fake.company() if random.random() > 0.2 else ''
        
        contact = {
            'firstName': first_name,
            'lastName': last_name,
            'email': email,
            'jobTitle': job_title,
            'countryCode': country_code,
            'companyName': company_name
        }
        
        contacts.append(contact)
    
    return contacts

def write_csv(contacts, filename):
    """Write contacts to a CSV file."""
    fieldnames = ['firstName', 'lastName', 'email', 'jobTitle', 'countryCode', 'companyName']
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(contacts)
    
    print(f"✅ Generated {len(contacts)} contacts in '{filename}'")

def main():
    # Parse command line arguments
    if len(sys.argv) > 1:
        try:
            num_contacts = int(sys.argv[1])
            if num_contacts <= 0:
                print("Error: Number of contacts must be positive")
                sys.exit(1)
        except ValueError:
            print(f"Error: Invalid number '{sys.argv[1]}'. Please provide a valid integer.")
            sys.exit(1)
    else:
        num_contacts = DEFAULT_NUM_CONTACTS
    
    # Generate random filename suffix
    random_suffix = generate_random_suffix()
    output_file = f'test_contacts_{num_contacts}_{random_suffix}.csv'
    
    print(f"Generating {num_contacts} test contacts...")
    contacts = generate_contacts(num_contacts)
    write_csv(contacts, output_file)
    
    # Print some stats
    with_job_title = sum(1 for c in contacts if c['jobTitle'])
    with_country = sum(1 for c in contacts if c['countryCode'])
    with_company = sum(1 for c in contacts if c['companyName'])
    
    print(f"\nStats:")
    print(f"  - Total contacts: {len(contacts)}")
    print(f"  - With job title: {with_job_title} ({with_job_title/len(contacts)*100:.1f}%)")
    print(f"  - With country code: {with_country} ({with_country/len(contacts)*100:.1f}%)")
    print(f"  - With company name: {with_company} ({with_company/len(contacts)*100:.1f}%)")

if __name__ == '__main__':
    main()
