#!/usr/bin/env python3
"""
Forensic Analysis Tool for PDF Files
Analyzes PDF structure for potential malicious patterns
"""

import re
import sys

def analyze_pdf(filepath):
    print("=" * 60)
    print("PDF FORENSIC ANALYSIS REPORT")
    print("=" * 60)
    
    # Read the PDF file
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Convert to text for pattern searching
    text_content = content.decode('latin-1', errors='ignore')
    
    print(f"\nFile: {filepath}")
    print(f"Size: {len(content)} bytes ({len(content)/1024:.1f} KB)")
    
    # Check PDF version
    version_match = re.search(r'%PDF-(\d+\.\d+)', text_content)
    if version_match:
        print(f"PDF Version: {version_match.group(1)}")
    
    print("\n" + "=" * 60)
    print("1. SEARCH FOR ATTACK VECTORS")
    print("=" * 60)
    
    # Define suspicious patterns to search for
    attack_vectors = {
        '/JS': (r'/JS(?![a-zA-Z])', 'JavaScript code execution'),
        '/JavaScript': (r'/JavaScript', 'JavaScript code execution'),
        '/Launch': (r'/Launch', 'External program launch'),
        '/Action': (r'/Action', 'Automated actions'),
        '/OpenAction': (r'/OpenAction', 'Actions on document open'),
        '/EmbeddedFile': (r'/EmbeddedFile', 'Embedded files'),
        '/URI': (r'/URI', 'External URIs/URLs'),
        '/AA': (r'/AA(?![a-zA-Z])', 'Additional actions'),
        '/Names': (r'/Names', 'Named destinations'),
        '/AcroForm': (r'/AcroForm', 'Interactive forms'),
        '/XFA': (r'/XFA', 'XFA forms'),
        '/Movie': (r'/Movie', 'Multimedia content'),
        '/Sound': (r'/Sound', 'Audio content'),
        '/3D': (r'/3D', '3D content'),
        '/Encrypt': (r'/Encrypt', 'Encryption'),
        '/FileAttachment': (r'/FileAttachment', 'File attachments'),
        '/GoTo': (r'/GoTo', 'Navigation actions'),
        '/GoToR': (r'/GoToR', 'Remote GoTo actions'),
        '/ImportData': (r'/ImportData', 'Data import'),
        '/SubmitForm': (r'/SubmitForm', 'Form submission')
    }
    
    found_vectors = []
    
    for name, (pattern, description) in attack_vectors.items():
        matches = re.findall(pattern, text_content, re.IGNORECASE)
        if matches:
            found_vectors.append((name, len(matches), description))
            print(f"⚠️  {name}: FOUND ({len(matches)} occurrences) - {description}")
            
            # Show context for first match
            first_match_pos = text_content.find(matches[0])
            start = max(0, first_match_pos - 30)
            end = min(len(text_content), first_match_pos + 50)
            context = text_content[start:end]
            # Clean up context for display
            context = ''.join(c if c.isprintable() or c.isspace() else '.' for c in context)
            print(f"    Context: ...{context}...")
        else:
            print(f"✅ {name}: NOT FOUND")
    
    print("\n" + "=" * 60)
    print("2. PDF STRUCTURE ANALYSIS")
    print("=" * 60)
    
    # Count standard PDF elements
    obj_count = len(re.findall(r'\d+ \d+ obj', text_content))
    stream_count = len(re.findall(r'stream', text_content))
    endstream_count = len(re.findall(r'endstream', text_content))
    xref_count = len(re.findall(r'xref', text_content))
    font_count = len(re.findall(r'/Font', text_content))
    page_count = len(re.findall(r'/Page(?![a-zA-Z])', text_content))
    image_count = len(re.findall(r'/Image', text_content))
    
    print(f"PDF Objects: {obj_count}")
    print(f"Streams: {stream_count} (endstream: {endstream_count})")
    print(f"Cross-references (xref): {xref_count}")
    print(f"Font references: {font_count}")
    print(f"Page references: {page_count}")
    print(f"Image references: {image_count}")
    
    if stream_count != endstream_count:
        print("⚠️  WARNING: Stream count mismatch (possible corruption)")
    
    # Check for suspicious long encoded strings
    print("\n" + "=" * 60)
    print("3. OBFUSCATION DETECTION")
    print("=" * 60)
    
    # Look for long base64 or hex strings
    long_b64_strings = re.findall(r'[A-Za-z0-9+/=]{500,}', text_content)
    long_hex_strings = re.findall(r'[0-9A-Fa-f]{500,}', text_content)
    
    if long_b64_strings:
        print(f"⚠️  Long Base64 strings found: {len(long_b64_strings)} blocks")
        print(f"    Longest: {len(max(long_b64_strings, key=len))} characters")
    else:
        print("✅ No suspiciously long Base64 blocks")
    
    if long_hex_strings:
        print(f"⚠️  Long hex strings found: {len(long_hex_strings)} blocks")
        print(f"    Longest: {len(max(long_hex_strings, key=len))} characters")
    else:
        print("✅ No suspiciously long hex blocks")
    
    # Check for URLs
    print("\n" + "=" * 60)
    print("4. EXTERNAL REFERENCES")
    print("=" * 60)
    
    urls = re.findall(r'https?://[^\s<>]+', text_content)
    if urls:
        print(f"⚠️  URLs found: {len(urls)}")
        for i, url in enumerate(urls[:5], 1):  # Show first 5
            print(f"    {i}. {url[:80]}{'...' if len(url) > 80 else ''}")
    else:
        print("✅ No URLs detected")
    
    # Extract metadata
    print("\n" + "=" * 60)
    print("5. METADATA ANALYSIS")
    print("=" * 60)
    
    producer = re.search(r'/Producer\s*\(([^)]+)\)', text_content)
    creator = re.search(r'/Creator\s*\(([^)]+)\)', text_content)
    title = re.search(r'/Title\s*\(([^)]+)\)', text_content)
    author = re.search(r'/Author\s*\(([^)]+)\)', text_content)
    creation_date = re.search(r'/CreationDate\s*\(([^)]+)\)', text_content)
    
    if producer:
        print(f"Producer: {producer.group(1)}")
    if creator:
        print(f"Creator: {creator.group(1)}")
    if title:
        print(f"Title: {title.group(1)}")
    if author:
        print(f"Author: {author.group(1)}")
    if creation_date:
        print(f"Creation Date: {creation_date.group(1)}")
    
    # Final verdict
    print("\n" + "=" * 60)
    print("FORENSIC ANALYSIS VERDICT")
    print("=" * 60)
    
    if found_vectors:
        print("⚠️  SUSPICIOUS PATTERNS DETECTED!")
        print("\nPotential triggers for antivirus detection:")
        for vector, count, desc in found_vectors:
            print(f"  - {vector}: {desc} ({count} occurrences)")
    else:
        print("✅ NO MALICIOUS PATTERNS DETECTED")
        print("\nThe PDF appears to be a standard document without:")
        print("  - JavaScript code")
        print("  - External actions or launches")
        print("  - Embedded files")
        print("  - Interactive forms")
        print("  - Suspicious URLs or URIs")
    
    print("\n" + "=" * 60)
    print("STRUCTURE ASSESSMENT")
    print("=" * 60)
    
    if obj_count > 0 and stream_count > 0:
        print("✅ PDF structure appears STANDARD")
        print(f"  - Contains {obj_count} standard PDF objects")
        print(f"  - Uses {stream_count} compressed streams")
        print(f"  - Has {image_count} embedded images")
    else:
        print("⚠️  PDF structure appears UNUSUAL")
    
    # iText specific check (common generator)
    if producer and 'iText' in producer.group(1):
        print("\n📝 Note: PDF generated by iText library (common Java PDF generator)")
        print("   This is typically used by banking and enterprise systems")

if __name__ == '__main__':
    analyze_pdf('/tmp/mcafee-evidence.pdf')