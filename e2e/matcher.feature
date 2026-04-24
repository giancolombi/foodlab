Feature: Ingredient Matcher
  Users enter ingredients they have and get recipe recommendations.

  Scenario: Submit ingredients for matching
    Given I am signed in
    And I navigate to "/"
    When I enter "chicken, rice, garlic, onion" as ingredients
    And I click the "Match recipes" button
    Then I should see a loading indicator
