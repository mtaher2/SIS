# Spam Detection API

A Flask-based REST API service for spam detection, designed to be integrated with Flutter applications.

## How It Works

The spam detection system uses a Naive Bayes machine learning model to classify text messages as spam or legitimate. When a client sends a message to the API endpoint, the system:

1. Preprocesses the text (normalizes, removes stop words)
2. Extracts features from the text
3. Passes these features to the trained model
4. Returns the classification result (spam/not spam) with a confidence score

The API can be accessed via HTTP requests, making it easy to integrate with Flutter applications.

## API Endpoints

- `GET /api/health` - Check if service is running
- `POST /api/predict` - Submit a message for spam classification
- `POST /api/train` - Retrain the ML model with new data

## Flutter Integration

Use the `http` package to make API calls from Flutter:

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<bool> checkForSpam(String message) async {
  final response = await http.post(
    Uri.parse('http://your-server-address:5000/api/predict'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'message': message}),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['is_spam'];
  } else {
    throw Exception('Failed to check message');
  }
}
``` 