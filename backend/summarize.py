import sys
import json
import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def generate_summary(last_summary, last10_messages_json):
    # Parse the last 10 messages
    last10_messages = json.loads(last10_messages_json)

    # Prepare the system prompt
    system_prompt = f"""You are a helpful assistant that summarizes conversations and updates the pedagogical/psychological profile of the user.
    Here is the current pedagogical portrait of the user:
    {last_summary}

    Improve this summary by adding or correcting information. Add new themes or interests the user has discussed in the last 10 messages. Focus on their learning preferences, psychological tendencies, and topics of interest.

    Here are the last 10 messages:
    {last10_messages_json}
    """

    # Prepare the messages array for the OpenAI API
    messages = [
        {"role": "system", "content": system_prompt}
    ]

    # Create a chat completion to generate a summary
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # Specify the model
        messages=messages
    )
    return response.choices[0].message.content.strip()

if __name__ == "__main__":
    if len(sys.argv) > 2:
        last_summary = sys.argv[1]   # First argument: last summary
        last10_messages_json = sys.argv[2]   # Second argument: last 10 messages (JSON string)
        print(generate_summary(last_summary, last10_messages_json))
    else:
        print("Usage: summarize.py '<last_summary>' '<last10_messages_json>'")