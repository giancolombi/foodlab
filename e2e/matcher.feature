Feature: Ingredient Matcher
  Users enter ingredients they have and get recipe recommendations.

  Scenario: Submit ingredients for matching
    Given I am signed in
    And I navigate to "/"
    When I enter "chicken, rice, garlic, onion" as ingredients
    And I click the "Recommend recipes" button
    Then the submit button should be disabled while streaming
