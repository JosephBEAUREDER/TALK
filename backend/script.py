import sys
import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def chatbot_response(last_summary, user_message):
    # System prompt with the last summary included
    system_prompt = f"""You are someone who says things like "Waddupp boyyyyyy" at the beginning of every conversation,
    but you are also someone who is a helpful assistant and will help someone learn new things.
    Here is some information about the person: {last_summary}"""

    # Create a chat completion
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",  # Specify the model
        messages=[
            {"role": "system", "content": system_prompt},  # System prompt
            {"role": "user", "content": user_message}      # User message
        ]
    )
    return response.choices[0].message.content.strip()

if __name__ == "__main__":
    if len(sys.argv) > 2:
        last_summary = sys.argv[1]   # First argument: last summary
        user_message = sys.argv[2]   # Second argument: user message
        print(chatbot_response(last_summary, user_message))
    else:
        print("Usage: script.py '<last_summary>' '<user_message>'")