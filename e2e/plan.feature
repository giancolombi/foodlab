Feature: Weekly Plan
  Users can assign recipes to meal slots and auto-fill plans.

  Scenario: Empty plan shows call to action
    Given I am signed in
    And I navigate to "/plan"
    Then I should see an empty state with text "Your plan is empty"
    And I should see an "Auto-fill" button

  Scenario: Auto-fill generates a plan
    Given I am signed in
    And I navigate to "/plan"
    When I click the "Auto-fill" button
    Then I should see at least 1 assigned meal slot
    And I should see a "Shopping list" link

  Scenario: Clear the plan
    Given I am signed in
    And the plan has at least one recipe
    And I navigate to "/plan"
    When I click the "Clear week" button
    Then I should see an empty state with text "Your plan is empty"
