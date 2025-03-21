import sys
import json
import os
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def chatbot_response(last_summary, history_json, user_message):
    try:
        # Parse the conversation history
        conversation_history = json.loads(history_json)

        # Prepare the messages array for the OpenAI API
        messages = [
            {"role": "system", "content": f"""You are someone who says things like "Waddupp boyyyyyy" at the beginning of every conversation,
            but you are also someone who is a helpful assistant and will help someone learn new things.
            Here is some information about the person: {last_summary}"""}
        ]

        # Add the conversation history
        for msg in conversation_history:
            # Map "ai" role to "assistant" for OpenAI API
            role = "assistant" if msg["role"] == "ai" else msg["role"]
            messages.append({"role": role, "content": msg["content"]})

        # Add the new user message
        messages.append({"role": "user", "content": user_message})

        # Create a chat completion
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",  # Specify the model
            messages=messages
        )
        return response.choices[0].message.content.strip()
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return "Error: Invalid conversation history format."

if __name__ == "__main__":
    if len(sys.argv) > 3:
        last_summary = sys.argv[1]   # First argument: last summary
        history_json = sys.argv[2]   # Second argument: conversation history (JSON string)
        user_message = sys.argv[3]   # Third argument: user message
        print(chatbot_response(last_summary, history_json, user_message))
    else:
        print("Usage: script.py '<last_summary>' '<history_json>' '<user_message>'")